import { describe, it, expect, beforeAll } from "vitest";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario } from "./harness";

let db: Db; let s: Scenario;
beforeAll(async () => { db = await createDb(); s = await seedScenario(db); });

const request = (uid: string, amount: number, note: string | null = null) => asUser(db, uid, async () => (await rows<{ id: string }>(db, "select request_advance($1, $2) id", [amount, note]))[0].id);

describe("Solicitudes de adelanto", () => {
  let reqA: string;
  it("el barbero pide un adelanto y solo puede tener uno pendiente", async () => {
    reqA = await request(s.barberA, 2000, "Para el arriendo");
    await expect(request(s.barberA, 1500)).rejects.toThrow(/request_pending/);
  });
  it("monto inválido se rechaza", async () => {
    await expect(request(s.barberB, 0)).rejects.toThrow(/invalid_amount/);
    await expect(request(s.barberB, -5)).rejects.toThrow(/invalid_amount/);
  });
  it("el dueño ve las solicitudes; cada barbero solo la suya; un extraño ninguna", async () => {
    await request(s.barberB, 3000);
    expect(await asUser(db, s.owner, () => rows(db, "select id from advance_requests"))).toHaveLength(2);
    expect(await asUser(db, s.barberA, () => rows(db, "select id from advance_requests"))).toHaveLength(1);
    expect(await asUser(db, s.stranger, () => rows(db, "select id from advance_requests"))).toHaveLength(0);
  });
  it("un barbero no puede aprobar su propia solicitud ni escribir en la tabla", async () => {
    await expect(asUser(db, s.barberA, () => rows(db, "select decide_advance_request($1, true, 'cash')", [reqA]))).rejects.toThrow(/forbidden/);
    await expect(asUser(db, s.barberA, () => rows(db, "update advance_requests set status='approved' where id=$1", [reqA]))).rejects.toThrow();
  });
  it("el dueño aprueba: queda el adelanto registrado y la solicitud cerrada", async () => {
    await asUser(db, s.owner, () => rows(db, "select decide_advance_request($1, true, 'cash', 'Aprobado')", [reqA]));
    const [r] = await rows<{ status: string; advance_id: string | null }>(db, "select status, advance_id from advance_requests where id=$1", [reqA]);
    expect(r.status).toBe("approved");
    const [a] = await rows<{ amount: string; member_id: string }>(db, "select amount::text, member_id from staff_advances where id=$1", [r.advance_id]);
    expect(a).toEqual({ amount: "2000", member_id: s.mA });
    await expect(asUser(db, s.owner, () => rows(db, "select decide_advance_request($1, false)", [reqA]))).rejects.toThrow(/request_closed/);
  });
  it("el dueño rechaza otra y no se registra adelanto", async () => {
    const [b] = await rows<{ id: string }>(db, "select id from advance_requests where member_id=$1 and status='pending'", [s.mB]);
    const before = (await rows<{ n: string }>(db, "select count(*)::text n from staff_advances"))[0].n;
    await asUser(db, s.owner, () => rows(db, "select decide_advance_request($1, false)", [b.id]));
    expect((await rows<{ status: string }>(db, "select status from advance_requests where id=$1", [b.id]))[0].status).toBe("rejected");
    expect((await rows<{ n: string }>(db, "select count(*)::text n from staff_advances"))[0].n).toBe(before);
  });
  it("quien pidió puede cancelar la suya; otro barbero no", async () => {
    const id = await request(s.barberA, 1000);
    await expect(asUser(db, s.barberB, () => rows(db, "select cancel_advance_request($1)", [id]))).rejects.toThrow(/forbidden/);
    await asUser(db, s.barberA, () => rows(db, "select cancel_advance_request($1)", [id]));
    expect((await rows<{ status: string }>(db, "select status from advance_requests where id=$1", [id]))[0].status).toBe("cancelled");
  });
  it("un extraño no puede pedir adelantos", async () => {
    await expect(request(s.stranger, 500)).rejects.toThrow(/forbidden/);
  });
});
