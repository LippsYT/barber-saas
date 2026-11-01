import { describe, it, expect, beforeAll } from "vitest";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario, scoped } from "./harness";

let db: Db; let s: Scenario;
const SECRET = scoped("billing");
const has = async (k: string) => (await rows<{ h: boolean }>(db, "select _biz_has($1, $2) h", [s.bid, k]))[0].h;
const msgOn = async () => (await rows<{ on: boolean }>(db, "select _msg_on($1, 'confirmation') \"on\"", [s.bid]))[0].on;
const sync = (status: string, addons: string[] | null) =>
  asUser(db, null, () => rows(db, "select billing_sync($1, 'cus_a', 'sub_a', $2, now() + interval '30 days', null, false, $3::text[])", [SECRET, status, addons]));
const billing = () => asUser(db, s.owner, async () => (await rows<{ b: { addons: string[]; all: boolean } }>(db, "select my_billing() b"))[0].b);
const REPORT = scoped("report");
const targets = async () => (await asUser(db, null, () => rows<{ business_id: string }>(db, "select * from report_targets($1)", [REPORT]))).map((r) => r.business_id);

beforeAll(async () => {
  db = await createDb(); s = await seedScenario(db);
  await rows(db, "update businesses set settings = settings || '{\"weekly_report\": true}'::jsonb where id=$1", [s.bid]);
  await asUser(db, null, () => rows(db, "select billing_link_customer($1, $2, 'cus_a')", [SECRET, s.bid]));
});

describe("complementos de la suscripción", () => {
  it("en prueba (sin pago) el negocio tiene todos los complementos", async () => {
    expect(await has("whatsapp")).toBe(true); expect(await has("inventario")).toBe(true);
    expect((await billing()).all).toBe(true);
    expect(await msgOn()).toBe(true);
    expect(await targets()).toContain(s.bid);
  });
  it("con la prueba vencida y el plan base, no tiene complementos ni mensajes ni informe", async () => {
    await rows(db, "update businesses set trial_ends_at = now() - interval '1 day' where id=$1", [s.bid]);
    await sync("active", []);
    const b = await billing();
    expect(b.all).toBe(false); expect(b.addons).toEqual([]);
    for (const k of ["whatsapp", "marketing", "informes", "inventario"]) expect(await has(k)).toBe(false);
    expect(await msgOn()).toBe(false);
    expect(await targets()).not.toContain(s.bid);
  });
  it("cada complemento contratado abre solo lo suyo", async () => {
    await sync("active", ["whatsapp"]);
    expect(await has("whatsapp")).toBe(true); expect(await has("marketing")).toBe(false);
    expect(await msgOn()).toBe(true);
    expect((await billing()).addons).toEqual(["whatsapp"]);
    await sync("active", ["whatsapp", "informes"]);
    expect(await targets()).toContain(s.bid);
  });
  it("el pedido de reseña pide además el complemento de reseñas", async () => {
    const review = async () => (await rows<{ on: boolean }>(db, "select _msg_on($1, 'review', true) \"on\"", [s.bid]))[0].on;
    await sync("active", ["whatsapp"]);
    expect(await review()).toBe(false);
    await sync("active", ["whatsapp", "resenas"]);
    expect(await review()).toBe(true);
    await sync("active", ["whatsapp", "informes"]);
    expect(await msgOn()).toBe(true); // la confirmación sigue con solo WhatsApp
  });
  it("si el webhook no manda la lista (null) se conserva la anterior; cancelada no da nada", async () => {
    await sync("past_due", null);
    expect((await billing()).addons).toEqual(["whatsapp", "informes"]);
    await sync("canceled", ["whatsapp"]);
    expect(await has("whatsapp")).toBe(false);
  });
  it("el negocio exento lo tiene todo siempre", async () => {
    await rows(db, "update businesses set billing_exempt = true where id=$1", [s.bid]);
    expect(await has("marketing")).toBe(true);
  });
});
