import { describe, it, expect, beforeAll } from "vitest";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario } from "./harness";

let db: Db; let s: Scenario;
const SECRET = "s".repeat(64);
beforeAll(async () => { db = await createDb(); s = await seedScenario(db); });

const enqueue = (phone: string, sendAt = "now() - interval '1 minute'") =>
  rows<{ id: string }>(db, `insert into scheduled_messages(business_id, client_id, kind, to_phone, payload, send_at) values ($1,$2,'custom',$3,'{"body":"hola"}', ${sendAt}) returning id`, [s.bid, s.client, phone]);

describe("cola de mensajes", () => {
  it("msg_claim exige el secreto", async () => {
    await expect(rows(db, "select * from msg_claim('malo')")).rejects.toThrow(/forbidden/);
  });
  it("toma solo vencidos, pasa a sending y no los repite", async () => {
    const [due] = await enqueue("+5491157604074");
    await enqueue("+5491157604074", "now() + interval '1 hour'");
    const got = await rows<{ id: string; attempts: number }>(db, "select * from msg_claim($1, 10)", [SECRET]);
    expect(got.map((g) => g.id)).toEqual([due.id]);
    expect(got[0].attempts).toBe(1);
    expect(await rows(db, "select * from msg_claim($1, 10)", [SECRET])).toHaveLength(0);
    expect((await rows<{ status: string }>(db, "select status from scheduled_messages where id=$1", [due.id]))[0].status).toBe("sending");
  });
  it("failed reintenta con backoff hasta 3 intentos; sent guarda el id", async () => {
    const [m] = await enqueue("+5491157604074");
    for (let i = 1; i <= 3; i++) {
      await db.exec(`update scheduled_messages set send_at = now() - interval '1 second' where id='${m.id}'`);
      const [c] = await rows<{ attempts: number }>(db, "select * from msg_claim($1, 10, null, $2)", [SECRET, m.id]);
      expect(c.attempts).toBe(i);
      const [f] = await rows<{ msg_finish: string }>(db, "select msg_finish($1,$2,'failed',null,'boom')", [SECRET, m.id]);
      expect(f.msg_finish).toBe(i < 3 ? "retry" : "failed");
    }
    const [m2] = await enqueue("+5491157604074");
    await rows(db, "select * from msg_claim($1, 10, null, $2)", [SECRET, m2.id]);
    await rows(db, "select msg_finish($1,$2,'sent','3EB0X')", [SECRET, m2.id]);
    const [r] = await rows<{ status: string; provider_msg_id: string }>(db, "select status, provider_msg_id from scheduled_messages where id=$1", [m2.id]);
    expect(r).toEqual({ status: "sent", provider_msg_id: "3EB0X" });
  });
  it("cancelar la cita encola aviso de cancelación y cancela recordatorios", async () => {
    const [a] = await asUser(db, s.owner, () => rows<{ id: string }>(db,
      "insert into appointments(business_id, client_id, member_id, starts_at, ends_at, source) values ($1,$2,$3, now() + interval '3 days', now() + interval '3 days 30 minutes', 'admin') returning id", [s.bid, s.client, s.mA]));
    await rows(db, "select schedule_reminders($1)", [a.id]);
    await asUser(db, s.owner, () => rows(db, "update appointments set status='cancelled' where id=$1", [a.id]));
    const m = await rows<{ kind: string; status: string; body: string }>(db, "select kind, status, payload->>'body' body from scheduled_messages where appointment_id=$1 order by kind", [a.id]);
    expect(m.filter((x) => x.kind === "reminder").every((x) => x.status === "cancelled")).toBe(true);
    const c = m.find((x) => x.kind === "cancellation")!;
    expect(c.status).toBe("pending");
    expect(c.body).toContain("fue cancelada");
    expect(c.body).toContain("{{BASE}}/barberia-test");
    expect(c.body).toMatch(/^❌ \*Cita cancelada\*/);
  });
  it("reactivación: botón manual (dueño) y job diario respeta toggle/días/futuras/duplicados", async () => {
    const [id] = await asUser(db, s.owner, () => rows<{ enqueue_reactivation_now: string }>(db, "select enqueue_reactivation_now($1)", [s.client]));
    const [b] = await rows<{ body: string }>(db, "select payload->>'body' body from scheduled_messages where id=$1", [id.enqueue_reactivation_now]);
    expect(b.body).toMatch(/^💈 \*Barbería Test\*\n\nHola Carlos, ya pasaron \d+ días desde tu último corte\. ¿Agendamos el próximo\?\n\nReserva aquí: \{\{BASE\}\}\/barberia-test$/);
    await expect(asUser(db, s.stranger, () => rows(db, "select enqueue_reactivation_now($1)", [s.client]))).rejects.toThrow(/forbidden/);
    await db.exec(`delete from scheduled_messages where kind='reactivation'; delete from appointments where client_id='${s.client}';`);
    await db.exec(`insert into appointments(business_id, client_id, member_id, starts_at, ends_at, source, status) values ('${s.bid}','${s.client}','${s.mA}', now() - interval '30 days', now() - interval '30 days' + interval '30 minutes', 'admin', 'completed')`);
    expect((await rows<{ n: number }>(db, "select enqueue_reactivations() n"))[0].n).toBe(0); // OFF por defecto
    await asUser(db, s.owner, () => rows(db, "select set_reactivation_settings(true, 25)"));
    expect((await rows<{ n: number }>(db, "select enqueue_reactivations() n"))[0].n).toBe(1);
    expect((await rows<{ n: number }>(db, "select enqueue_reactivations() n"))[0].n).toBe(0); // ya avisado
    await db.exec(`delete from scheduled_messages where kind='reactivation'`);
    await asUser(db, s.owner, () => rows(db, "select set_reactivation_settings(true, 40)"));
    expect((await rows<{ n: number }>(db, "select enqueue_reactivations() n"))[0].n).toBe(0); // 30 < 40 días
  });
  it("0019: token corto único, recordatorios con formato y link /c/", async () => {
    const [a] = await asUser(db, s.owner, () => rows<{ id: string; short_token: string }>(db,
      "insert into appointments(business_id, client_id, member_id, starts_at, ends_at, source) values ($1,$2,$3, '2030-11-02 15:10:00+00', '2030-11-02 15:40:00+00', 'admin') returning id, short_token", [s.bid, s.client, s.mA]));
    expect(a.short_token).toMatch(/^[A-Za-z0-9]{9}$/);
    await rows(db, "select schedule_reminders($1)", [a.id]);
    const m = await rows<{ body: string }>(db, "select payload->>'body' body from scheduled_messages where appointment_id=$1 and kind='reminder' order by send_at", [a.id]);
    expect(m).toHaveLength(2);
    expect(m[0].body).toMatch(/mañana tienes cita/);
    expect(m[1].body).toMatch(/en 2 horas/);
    expect(m[0].body).toContain(`Ver o cancelar tu cita: {{BASE}}/c/${a.short_token}`);
    const [l] = await rows<{ j: { manage_token: string } }>(db, "select public_short_lookup($1) j", [a.short_token]);
    expect(l.j.manage_token).toBeTruthy();
    const [f] = await rows<{ f: string }>(db, "select _fecha_es('2026-10-31 15:10:00+00', 'America/Guayaquil') f");
    expect(f.f).toBe("Sábado 31 de octubre, 10:10 a. m.");
    const [f2] = await rows<{ f: string }>(db, "select _fecha_es('2026-10-31 17:05:00+00', 'America/Guayaquil') f");
    expect(f2.f).toBe("Sábado 31 de octubre, 12:05 p. m.");
    expect((await rows<{ u: string }>(db, "select _usd(1200) u"))[0].u).toBe("US$ 12,00");
  });
});
