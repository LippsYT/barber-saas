import { describe, it, expect, beforeAll } from "vitest";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario } from "./harness";

let db: Db; let s: Scenario; let tz: string; let day: string; let dow: number;
const SECRET = "s".repeat(64);
const slots = async () => (await asUser(db, null, () => rows(db, "select * from public_get_availability('barberia-test', $1, $2::uuid[], $3::date)", [s.mA, `{${s.corte}}`, day]))).length;
const billing = () => asUser(db, s.owner, async () => (await rows<{ b: { active: boolean; status: string } }>(db, "select my_billing() b"))[0].b);

beforeAll(async () => {
  db = await createDb(); s = await seedScenario(db);
  tz = (await rows<{ timezone: string }>(db, "select timezone from businesses where id=$1", [s.bid]))[0].timezone;
  const d = (await rows<{ d: string; w: number }>(db, "select ((now() at time zone $1)::date + 3)::text d, extract(dow from (now() at time zone $1)::date + 3)::int w", [tz]))[0];
  day = d.d; dow = d.w;
  await rows(db, "insert into working_hours(business_id, member_id, weekday, start_time, end_time) values ($1,$2,$3,'08:00','20:00')", [s.bid, s.mA, dow]);
});

describe("bloqueo por falta de pago", () => {
  it("un negocio nuevo tiene 14 días de prueba y puede recibir reservas", async () => {
    const [r] = await rows<{ d: number }>(db, "select extract(day from trial_ends_at - now())::int d from businesses where id=$1", [s.bid]);
    expect(r.d).toBeGreaterThanOrEqual(13);
    expect((await billing()).active).toBe(true);
    expect(await slots()).toBeGreaterThan(0);
  });
  it("nadie puede estirarse la prueba ni eximirse desde la app", async () => {
    await expect(asUser(db, s.owner, () => rows(db, "update businesses set trial_ends_at = now() + interval '10 years' where id=$1", [s.bid]))).rejects.toThrow(/forbidden/);
    await expect(asUser(db, s.owner, () => rows(db, "update businesses set billing_exempt = true where id=$1", [s.bid]))).rejects.toThrow(/forbidden/);
    await asUser(db, s.owner, () => rows(db, "update businesses set name = 'Otro nombre' where id=$1", [s.bid])); // lo demás sí se edita
  });
  it("vencida la prueba y sin pago: bloqueado y sin horarios para los clientes", async () => {
    await rows(db, "update businesses set trial_ends_at = now() - interval '1 day' where id=$1", [s.bid]);
    expect((await billing()).active).toBe(false);
    expect(await slots()).toBe(0);
  });
  it("la suscripción activa (o con pago pendiente) desbloquea; la cancelada no", async () => {
    await asUser(db, null, () => rows(db, "select billing_link_customer($1, $2, 'cus_x')", [SECRET, s.bid]));
    const set = (st: string) => asUser(db, null, () => rows(db, "select billing_sync($1, 'cus_x', 'sub_x', $2, now() + interval '30 days', null, false)", [SECRET, st]));
    await set("active"); expect((await billing()).active).toBe(true); expect(await slots()).toBeGreaterThan(0);
    await set("past_due"); expect((await billing()).active).toBe(true);
    await set("canceled"); expect((await billing()).active).toBe(false); expect(await slots()).toBe(0);
  });
  it("un negocio exento nunca se bloquea; otro usuario no ve el estado ajeno", async () => {
    await rows(db, "update businesses set billing_exempt = true where id=$1", [s.bid]);
    expect((await billing()).active).toBe(true);
    expect(await asUser(db, s.stranger, async () => (await rows<{ b: unknown }>(db, "select my_billing() b"))[0].b)).toBeNull();
  });
});
