import { describe, it, expect, beforeAll } from "vitest";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario, scoped } from "./harness";

let db: Db; let s: Scenario;
const BILLING = scoped("billing"); const MESSAGES = scoped("messages");
const sync = (status: string, addons: string[]) =>
  asUser(db, null, () => rows(db, "select billing_sync($1, 'cus_g', 'sub_g', $2, now() + interval '30 days', null, false, $3::text[])", [BILLING, status, addons]));
const queue = async () => (await rows<{ id: string }>(db,
  "insert into scheduled_messages(business_id, client_id, kind, to_phone, payload, send_at) values ($1, $2, 'reminder', '+593991112222', '{\"body\":\"hola\"}'::jsonb, now() - interval '1 minute') returning id", [s.bid, s.client]))[0].id;
const claim = () => asUser(db, null, () => rows<{ id: string }>(db, "select * from msg_claim($1, 20)", [MESSAGES]));
const status = async (id: string) => (await rows<{ status: string; error: string | null }>(db, "select status, error from scheduled_messages where id=$1", [id]))[0];

beforeAll(async () => {
  db = await createDb(); s = await seedScenario(db);
  await asUser(db, null, () => rows(db, "select billing_link_customer($1, $2, 'cus_g')", [BILLING, s.bid]));
});

describe("El envío de WhatsApp exige el complemento", () => {
  it("en la prueba (todo incluido) el mensaje sale", async () => {
    const id = await queue();
    expect((await claim()).map((r) => r.id)).toContain(id);
  });
  it("con plan pagado sin WhatsApp, lo programado se descarta y no sale", async () => {
    await rows(db, "update businesses set trial_ends_at = now() - interval '1 day' where id=$1", [s.bid]);
    await sync("active", []);
    const id = await queue();
    expect((await claim()).map((r) => r.id)).not.toContain(id);
    expect(await status(id)).toEqual({ status: "skipped", error: "addon_required" });
  });
  it("al contratar WhatsApp, los mensajes nuevos vuelven a salir", async () => {
    await sync("active", ["whatsapp"]);
    const id = await queue();
    expect((await claim()).map((r) => r.id)).toContain(id);
  });
  it("sin WhatsApp propio conectado no sale por la instancia de otro negocio", async () => {
    const inst = async (fallback: string) => {
      const id = await queue();
      const got = await asUser(db, null, () => rows<{ id: string; instance_name: string | null }>(db, "select * from msg_claim($1, 20, null, null, $2)", [MESSAGES, fallback]));
      return got.find((r) => r.id === id)?.instance_name ?? null;
    };
    expect(await inst("pulso-lumos-studio")).toBeNull();
    expect(await inst("pulso-barberia-test")).toBe("pulso-barberia-test");
  });
  it("con su WhatsApp conectado usa el suyo, no el de respaldo", async () => {
    await rows(db, "insert into whatsapp_links(business_id, phone, instance_name, status, demo, provider) values ($1, '593991112222', 'pulso-propio', 'connected', false, 'evolution') on conflict (business_id) do update set status='connected', demo=false, instance_name='pulso-propio'", [s.bid]);
    const id = await queue();
    const got = await asUser(db, null, () => rows<{ id: string; instance_name: string | null }>(db, "select * from msg_claim($1, 20, null, null, 'pulso-lumos-studio')", [MESSAGES]));
    expect(got.find((r) => r.id === id)?.instance_name).toBe("pulso-propio");
  });
});
