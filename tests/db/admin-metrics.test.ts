import { describe, it, expect, beforeAll } from "vitest";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario, scoped } from "./harness";

let db: Db; let s: Scenario;
const BILLING = scoped("billing"), METRICS = scoped("metrics");
const metrics = async (since = "now() - interval '7 days'") =>
  (await asUser(db, null, () => rows<{ m: Record<string, any> }>(db, `select admin_metrics($1, ${since}) m`, [METRICS])))[0].m;
const pay = (inv: string, amount: number, cur = "usd") =>
  asUser(db, null, () => rows<{ r: boolean }>(db, "select billing_record_payment($1, 'cus_m', $2, $3, $4, now()) r", [BILLING, inv, amount, cur]));

beforeAll(async () => {
  db = await createDb(); s = await seedScenario(db);
  await asUser(db, null, () => rows(db, "select billing_link_customer($1, $2, 'cus_m')", [BILLING, s.bid]));
});

describe("0038: métricas del panel", () => {
  it("exige el token del dominio 'metrics' (ni el de otro dominio ni el crudo)", async () => {
    await expect(asUser(db, null, () => rows(db, "select admin_metrics($1)", [BILLING]))).rejects.toThrow(/forbidden/);
    await expect(asUser(db, null, () => rows(db, "select admin_metrics('x')"))).rejects.toThrow(/forbidden/);
    await expect(asUser(db, null, () => rows(db, "select billing_record_payment($1, 'c', 'i', 1, 'usd', now())", [METRICS]))).rejects.toThrow(/forbidden/);
  });
  it("cuenta el negocio en prueba y en el feed como registro", async () => {
    await rows(db, "update businesses set billing_exempt = false, trial_ends_at = now() + interval '10 days' where id=$1", [s.bid]);
    const m = await metrics();
    expect(m.signups.total).toBeGreaterThanOrEqual(1);
    expect(m.trial.active).toBeGreaterThanOrEqual(1);
    expect(m.subscribed.active).toBe(0);
    expect(m.events.some((e: any) => e.type === "signup" && e.id === `signup:${s.bid}`)).toBe(true);
  });
  it("un negocio exento no cuenta", async () => {
    const before = (await metrics()).signups.total;
    await rows(db, "update businesses set billing_exempt = true where id=$1", [s.bid]);
    expect((await metrics()).signups.total).toBe(before - 1);
    await rows(db, "update businesses set billing_exempt = false where id=$1", [s.bid]);
  });
  it("al suscribirse pasa de prueba a suscrito y aparece para el MRR", async () => {
    const trialBefore = (await metrics()).trial.active;
    await asUser(db, null, () => rows(db, "select billing_sync($1, 'cus_m', 'sub_m', 'active', now() + interval '30 days', null, false, array['whatsapp'])", [BILLING]));
    const m = await metrics();
    expect(m.subscribed.active).toBe(1);
    expect(m.trial.active).toBe(trialBefore - 1);
    expect(m.active_subs).toEqual([{ currency: "USD", addons: ["whatsapp"] }]);
  });
  it("un pago se guarda una sola vez, suma por moneda y sale en el feed con el nombre del negocio", async () => {
    expect((await pay("in_1", 3000))[0].r).toBe(true);
    expect((await pay("in_1", 3000))[0].r).toBe(false);
    await pay("in_2", 2100000, "ars");
    const m = await metrics();
    const usd = m.revenue.find((r: any) => r.currency === "usd"), ars = m.revenue.find((r: any) => r.currency === "ars");
    expect(usd).toMatchObject({ total: 3000, month: 3000, payments: 1 });
    expect(ars.total).toBe(2100000);
    const ev = m.events.find((e: any) => e.id === "payment:in_1");
    expect(ev).toMatchObject({ type: "payment", amount: 3000, currency: "usd" });
    expect(typeof ev.business).toBe("string");
  });
  it("los eventos respetan `since`", async () => {
    const m = await metrics("now() + interval '1 hour'");
    expect(m.events).toEqual([]);
  });
  it("las tablas no se leen con el cliente de la app", async () => {
    await expect(asUser(db, s.owner, () => rows(db, "select * from billing_payments"))).rejects.toThrow();
  });
});
