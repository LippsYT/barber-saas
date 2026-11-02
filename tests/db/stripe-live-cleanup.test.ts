import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario, scoped } from "./harness";

let db: Db; let s: Scenario;
beforeAll(async () => { db = await createDb(); s = await seedScenario(db); });

describe("0033: limpieza de ids de Stripe de prueba", () => {
  it("deja la suscripción en 'none' sin ids y no toca negocio ni citas", async () => {
    const SECRET = scoped("billing");
    await asUser(db, null, () => rows(db, "select billing_link_customer($1, $2, 'cus_test_1')", [SECRET, s.bid]));
    await asUser(db, null, () => rows(db, "select billing_sync($1, 'cus_test_1', 'sub_test_1', 'active', now() + interval '30 days', null, false, array['whatsapp'])", [SECRET]));
    const [before] = await rows<{ b: string; a: string }>(db, "select (select count(*) from businesses)::text b, (select count(*) from appointments)::text a");

    await db.exec(fs.readFileSync(path.join(process.cwd(), "supabase/migrations/0033_stripe_live_cleanup.sql"), "utf8"));

    const [sub] = await rows<{ stripe_customer_id: string | null; stripe_subscription_id: string | null; status: string; addons: string[]; cancel_at_period_end: boolean }>(
      db, "select stripe_customer_id, stripe_subscription_id, status, addons, cancel_at_period_end from subscriptions where business_id=$1", [s.bid]);
    expect(sub).toEqual({ stripe_customer_id: null, stripe_subscription_id: null, status: "none", addons: [], cancel_at_period_end: false });
    const [after] = await rows<{ b: string; a: string }>(db, "select (select count(*) from businesses)::text b, (select count(*) from appointments)::text a");
    expect(after).toEqual(before);
  });
  it("después de limpiar, el negocio puede vincular un cliente live nuevo", async () => {
    const SECRET = scoped("billing");
    await asUser(db, null, () => rows(db, "select billing_link_customer($1, $2, 'cus_live_1')", [SECRET, s.bid]));
    const [r] = await rows<{ stripe_customer_id: string }>(db, "select stripe_customer_id from subscriptions where business_id=$1", [s.bid]);
    expect(r.stripe_customer_id).toBe("cus_live_1");
  });
});
