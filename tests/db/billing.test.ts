import { describe, it, expect, beforeAll } from "vitest";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario } from "./harness";

let db: Db; let s: Scenario;
const SECRET = "s".repeat(64);
beforeAll(async () => { db = await createDb(); s = await seedScenario(db); });

describe("Suscripción (Stripe)", () => {
  it("sin el secreto del servidor nadie puede escribir", async () => {
    await expect(asUser(db, null, () => rows(db, "select billing_link_customer('x', $1, 'cus_1')", [s.bid]))).rejects.toThrow();
    await expect(asUser(db, s.owner, () => rows(db, "select billing_sync($1, 'cus_1', 'sub_1', 'active', now(), null, false)", ["a".repeat(64)]))).rejects.toThrow();
    await expect(asUser(db, s.owner, () => rows(db, "update subscriptions set status='active' where business_id=$1", [s.bid]))).rejects.toThrow();
  });
  it("el servidor vincula el cliente y sincroniza el estado", async () => {
    await asUser(db, null, () => rows(db, "select billing_link_customer($1, $2, 'cus_1')", [SECRET, s.bid]));
    const [ok] = await asUser(db, null, () => rows<{ ok: boolean }>(db, "select billing_sync($1, 'cus_1', 'sub_1', 'active', now() + interval '30 days', null, false) ok", [SECRET]));
    expect(ok.ok).toBe(true);
    const [none] = await asUser(db, null, () => rows<{ ok: boolean }>(db, "select billing_sync($1, 'cus_zzz', 'sub_9', 'active', now(), null, false) ok", [SECRET]));
    expect(none.ok).toBe(false);
  });
  it("dueño y admin ven el estado; barbero y extraños no", async () => {
    const [mine] = await asUser(db, s.owner, () => rows<{ status: string; stripe_subscription_id: string }>(db, "select status, stripe_subscription_id from subscriptions where business_id=$1", [s.bid]));
    expect(mine).toMatchObject({ status: "active", stripe_subscription_id: "sub_1" });
    expect(await asUser(db, s.barberA, () => rows(db, "select * from subscriptions"))).toHaveLength(0);
    expect(await asUser(db, s.stranger, () => rows(db, "select * from subscriptions"))).toHaveLength(0);
  });
});
