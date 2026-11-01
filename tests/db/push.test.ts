import { describe, it, expect, beforeAll } from "vitest";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario } from "./harness";

let db: Db; let s: Scenario;
const SECRET = "s".repeat(64);
const EP = (n: string) => `https://push.example.test/send/${n.padEnd(30, "x")}`;
const claim = async () => (await asUser(db, null, () => rows<{ c: { title: string; body: string; url: string; subs: { endpoint: string }[] }[] }>(db, "select push_claim($1) c", [SECRET])))[0].c;
let slot = 0; // cada cita en un horario distinto: el mismo barbero no puede tener dos a la vez
const book = (source: string, status = "confirmed") => rows<{ id: string }>(db,
  "insert into appointments(business_id, client_id, member_id, starts_at, ends_at, status, source) values ($1,$2,$3, now() + make_interval(days => 2, hours => $6::int), now() + make_interval(days => 2, hours => $6::int, mins => 30), $4::appointment_status, $5::appointment_source) returning id",
  [s.bid, s.client, s.mA, status, source, ++slot]);
const save = (uid: string, ep: string) => asUser(db, uid, () => rows(db, "select push_save($1, 'p256dhkey', 'authkey', 'iPhone')", [ep]));

beforeAll(async () => {
  db = await createDb(); s = await seedScenario(db);
  await save(s.owner, EP("owner")); await save(s.barberA, EP("barbera")); await save(s.barberB, EP("barberb"));
});

describe("notificaciones push", () => {
  it("solo guarda dispositivos válidos y cada persona ve y borra los suyos", async () => {
    await expect(save(s.owner, "http://inseguro.test/abc")).rejects.toThrow(/invalid_subscription/);
    await expect(asUser(db, null, () => rows(db, "select push_save($1,'a','b')", [EP("anon")]))).rejects.toThrow();
    expect((await asUser(db, s.owner, () => rows(db, "select * from push_subscriptions"))).length).toBe(1);
    await asUser(db, s.barberB, () => rows(db, "select push_remove($1)", [EP("owner")])); // ajeno: no borra
    expect((await asUser(db, s.owner, () => rows(db, "select * from push_subscriptions"))).length).toBe(1);
    await asUser(db, s.barberB, () => rows(db, "select push_remove($1)", [EP("barberb")]));
    await save(s.barberB, EP("barberb"));
  });
  it("las claves VAPID solo se leen y escriben con el secreto; la pública la ve quien tiene sesión", async () => {
    await expect(asUser(db, null, () => rows(db, "select push_vapid('x')"))).rejects.toThrow(/forbidden/);
    expect((await asUser(db, null, () => rows<{ v: unknown }>(db, "select push_vapid($1) v", [SECRET])))[0].v).toBeNull();
    await asUser(db, null, () => rows(db, "select push_vapid_set($1, 'PUB', 'PRIV')", [SECRET]));
    await asUser(db, null, () => rows(db, "select push_vapid_set($1, 'OTRA', 'OTRA')", [SECRET])); // no pisa la primera
    expect((await asUser(db, s.owner, () => rows<{ k: string }>(db, "select push_public_key() k")))[0].k).toBe("PUB");
    await expect(asUser(db, null, () => rows(db, "select push_public_key() k"))).rejects.toThrow(); // sin sesión no
    await expect(asUser(db, s.owner, () => rows(db, "select * from push_config"))).rejects.toThrow();
  });
  it("una reserva del cliente avisa al dueño, al admin y al barbero de la cita, no a los demás", async () => {
    await book("booking_link");
    const out = await claim();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ title: "Nueva reserva", url: "/app/agenda" });
    expect(out[0].body).toContain("Carlos"); expect(out[0].body).toContain("Juan Pérez");
    const eps = out[0].subs.map((x) => x.endpoint).sort();
    expect(eps).toEqual([EP("barbera"), EP("owner")].sort()); // barberB no es de esta cita; el admin no tiene dispositivo
    expect(await claim()).toEqual([]); // ya salió de la cola
  });
  it("lo que crea el personal no avisa; la cancelación del cliente sí, la del personal no", async () => {
    const [a] = await book("admin");
    expect(await claim()).toEqual([]);
    await asUser(db, s.owner, () => rows(db, "update appointments set status='cancelled' where id=$1", [a.id]));
    expect(await claim()).toEqual([]);
    const [b] = await book("whatsapp");
    await claim();
    await rows(db, "update appointments set status='cancelled' where id=$1", [b.id]); // sin sesión, como la RPC pública de cancelar
    const out = await claim();
    expect(out).toHaveLength(1); expect(out[0].title).toBe("Cita cancelada");
  });
  it("el aviso de prueba va solo a quien lo pide y se limpian los dispositivos muertos", async () => {
    await asUser(db, s.owner, () => rows(db, "select push_test()"));
    const out = await claim();
    expect(out).toHaveLength(1);
    expect(out[0].subs.map((x) => x.endpoint)).toEqual([EP("owner")]);
    const n = (await asUser(db, null, () => rows<{ n: number }>(db, "select push_prune($1, array[$2]) n", [SECRET, EP("owner")])))[0].n;
    expect(n).toBe(1);
    await expect(asUser(db, null, () => rows(db, "select push_claim('mala')"))).rejects.toThrow(/forbidden/);
  });
});
