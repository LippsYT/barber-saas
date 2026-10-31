import { describe, it, expect, beforeAll } from "vitest";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario } from "./harness";

let db: Db; let s: Scenario; let apptId: string;
const settings = async () => (await rows<{ settings: Record<string, any> }>(db, "select settings from businesses where id=$1", [s.bid]))[0].settings;
const msgs = async (kind: string) => rows<{ body: string }>(db, "select payload->>'body' body from scheduled_messages where appointment_id=$1 and kind=$2 order by send_at", [apptId, kind]);

beforeAll(async () => {
  db = await createDb(); s = await seedScenario(db);
  await rows(db, "update clients set whatsapp_opt_in=true where id=$1", [s.client]);
  apptId = (await rows<{ id: string }>(db, "insert into appointments(business_id, client_id, member_id, starts_at, ends_at, source) values ($1,$2,$3, now() + interval '3 days', now() + interval '3 days 30 minutes', 'admin') returning id", [s.bid, s.client, s.mA]))[0].id;
  await rows(db, "insert into appointment_items(business_id, appointment_id, service_id, name, price, duration_min) values ($1,$2,$3,'Corte clásico',2500,30)", [s.bid, apptId, s.corte]);
});

describe("set_business_settings", () => {
  it("el dueño guarda reglas y mezcla los mensajes sin pisar lo anterior", async () => {
    await asUser(db, s.owner, () => rows(db, "select set_business_settings($1::jsonb)", [JSON.stringify({ min_notice_min: 120, cancel_notice_min: 240, messages: { reminder2: false } })]));
    await asUser(db, s.owner, () => rows(db, "select set_business_settings($1::jsonb)", [JSON.stringify({ messages: { review: true } })]));
    const st = await settings();
    expect(st).toMatchObject({ min_notice_min: 120, cancel_notice_min: 240, max_advance_days: 30 });
    expect(st.messages).toEqual({ reminder2: false, review: true });
  });
  it("un barbero no puede y los valores raros se rechazan", async () => {
    await expect(asUser(db, s.barberA, () => rows(db, "select set_business_settings('{\"min_notice_min\":5}')"))).rejects.toThrow();
    for (const bad of [{ nada: 1 }, { min_notice_min: -1 }, { slot_step_min: 7 }, { messages: { otro: true } }, { review_url: "http://x.co" }, { time_format: "13" }, { messages_text: { confirmation: "x".repeat(601) } }]) {
      await expect(asUser(db, s.owner, () => rows(db, "select set_business_settings($1::jsonb)", [JSON.stringify(bad)]))).rejects.toThrow();
    }
  });
});

describe("mensajes automáticos", () => {
  it("un recordatorio apagado no se programa", async () => {
    await rows(db, "select schedule_reminders($1)", [apptId]);
    const r = await rows<{ body: string }>(db, "select payload->>'body' body from scheduled_messages where appointment_id=$1 and kind='reminder'", [apptId]);
    expect(r).toHaveLength(1);
    expect(r[0].body).toContain("mañana tienes cita");
  });
  it("el texto propio reemplaza los campos y siempre trae el enlace de cancelar", async () => {
    await asUser(db, s.owner, () => rows(db, "select set_business_settings($1::jsonb)", [JSON.stringify({ messages_text: { confirmation: "Hola @nombre_cliente, te esperamos en @nombre_del_negocio con @barbero. @servicios" } })]));
    const [{ b }] = await rows<{ b: string }>(db, "select _wa_cita_body('confirmation', $1) b", [apptId]);
    expect(b).toContain("Hola Carlos, te esperamos en Barbería Test con Juan Pérez. Corte clásico");
    expect(b).toContain("{{BASE}}/c/");
    await asUser(db, s.owner, () => rows(db, "select set_business_settings($1::jsonb)", [JSON.stringify({ messages_text: { confirmation: null } })]));
    const [{ b: def }] = await rows<{ b: string }>(db, "select _wa_cita_body('confirmation', $1) b", [apptId]);
    expect(def).toContain("Cita confirmada");
  });
  it("la reseña se programa al completar la cita solo si hay enlace", async () => {
    await rows(db, "update appointments set status='completed' where id=$1", [apptId]);
    expect(await msgs("review")).toHaveLength(0);
    await asUser(db, s.owner, () => rows(db, "select set_business_settings($1::jsonb)", [JSON.stringify({ review_url: "https://g.page/r/abc" })]));
    const a2 = (await rows<{ id: string }>(db, "insert into appointments(business_id, client_id, member_id, starts_at, ends_at, source) values ($1,$2,$3, now() + interval '4 days', now() + interval '4 days 30 minutes', 'admin') returning id", [s.bid, s.client, s.mA]))[0].id;
    await rows(db, "update appointments set status='completed' where id=$1", [a2]);
    const r = await rows<{ body: string }>(db, "select payload->>'body' body from scheduled_messages where appointment_id=$1 and kind='review'", [a2]);
    expect(r).toHaveLength(1);
    expect(r[0].body).toContain("https://g.page/r/abc");
  });
});

describe("cancelar con antelación", () => {
  it("el cliente no puede cancelar dentro del margen del negocio", async () => {
    const [{ id, t }] = await rows<{ id: string; t: string }>(db, "insert into appointments(business_id, client_id, member_id, starts_at, ends_at, source) values ($1,$2,$3, now() + interval '1 hour', now() + interval '90 minutes', 'admin') returning id, manage_token t", [s.bid, s.client, s.mA]);
    await expect(asUser(db, null, () => rows(db, "select public_cancel_booking($1)", [t]))).rejects.toThrow(/cancel_too_late/);
    await asUser(db, s.owner, () => rows(db, "select set_business_settings('{\"cancel_notice_min\":0}')"));
    const [ok] = await asUser(db, null, () => rows<{ ok: boolean }>(db, "select public_cancel_booking($1) ok", [t]));
    expect(ok.ok).toBe(true);
    expect(id).toBeTruthy();
  });
});
