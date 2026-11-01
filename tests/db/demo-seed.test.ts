import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario } from "./harness";

let db: Db; let s: Scenario; let tz: string; let hoy: string;
type Caja = {
  service_income: number; tips: number; income: number; expenses: number; net: number; expected_cash: number; locked: boolean;
  by_method: Record<"cash" | "transfer", { in: number; out: number; net: number }>;
  services: { name: string; qty: number; total: number }[]; expenses_list: unknown[];
};
const caja = () => asUser(db, s.owner, async () => (await rows<{ c: Caja }>(db, "select caja_dia($1, $2::date) c", [s.bid, hoy]))[0].c);
const script = () => fs.readFileSync(path.resolve(import.meta.dirname, "../../supabase/seed/demo_dia_completo.sql"), "utf8").replace("'lumos-studio'", "'barberia-test'");

beforeAll(async () => {
  db = await createDb(); s = await seedScenario(db);
  tz = (await rows<{ timezone: string }>(db, "select timezone from businesses where id=$1", [s.bid]))[0].timezone;
  hoy = (await rows<{ d: string }>(db, "select (now() at time zone $1)::date::text d", [tz]))[0].d;
  await db.exec(script());
});

describe("demo de un día completo", () => {
  it("carga el catálogo de la peluquería original y un equipo nuevo", async () => {
    const [{ n }] = await rows<{ n: number }>(db, "select count(*)::int n from services where business_id=$1 and name ilike 'servicio premium'", [s.bid]);
    expect(n).toBe(1);
    const [{ m }] = await rows<{ m: number }>(db, "select count(*)::int m from memberships where business_id=$1 and display_name in ('Mateo Rivas','Sebastián Mora','Diego Cedeño','Camila Vera','Rosa Intriago')", [s.bid]);
    expect(m).toBe(5);
  });
  it("la caja del día cuadra: ingresos, propinas, gastos y efectivo esperado", async () => {
    const c = await caja();
    expect(c.locked).toBe(false);
    expect(c.service_income).toBeGreaterThan(30000);
    expect(c.tips).toBe(300 + 200 + 500 + 100 + 200 + 500 + 200 + 300); // propinas de las citas cobradas
    expect(c.income).toBe(c.service_income + c.tips);
    expect(c.expenses).toBe(4500 + 2500 + 3000 + 1200);
    expect(c.net).toBe(c.income - c.expenses);
    // El efectivo esperado = cobros en efectivo - gastos en efectivo - adelanto en efectivo.
    expect(c.expected_cash).toBe(c.by_method.cash.net - 2000);
    expect(c.by_method.transfer.in).toBeGreaterThan(0);
  });
  it("no deja mensajes pendientes a los clientes inventados y respeta las citas no cobradas", async () => {
    const [{ n }] = await rows<{ n: number }>(db, "select count(*)::int n from scheduled_messages where business_id=$1", [s.bid]);
    expect(n).toBe(0);
    const st = await rows<{ status: string; n: number }>(db, "select status::text, count(*)::int n from appointments where business_id=$1 group by 1 order by 1", [s.bid]);
    const by = Object.fromEntries(st.map((r) => [r.status, r.n]));
    expect(by.cancelled).toBe(1); expect(by.no_show).toBe(1); expect(by.confirmed).toBe(3);
    expect(by.completed).toBe(21);
  });
  it("las comisiones salen solas y se puede cerrar el día", async () => {
    const [{ n }] = await rows<{ n: number }>(db, "select count(*)::int n from commission_entries where business_id=$1", [s.bid]);
    expect(n).toBeGreaterThan(20);
    const c = await caja();
    const r = await asUser(db, s.owner, async () => (await rows<{ r: { difference: number } }>(db, "select close_cash_day($1, $2::date, $3) r", [s.bid, hoy, c.expected_cash]))[0].r);
    expect(r.difference).toBe(0);
    expect((await caja()).locked).toBe(true);
  });
  it("correrla otra vez no duplica nada", async () => {
    await db.exec(script());
    const [{ n }] = await rows<{ n: number }>(db, "select count(*)::int n from clients where business_id=$1 and 'demo' = any(tags)", [s.bid]);
    expect(n).toBe(20);
  });
});
