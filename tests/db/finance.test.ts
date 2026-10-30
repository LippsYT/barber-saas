import { describe, it, expect, beforeAll } from "vitest";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario } from "./harness";
import { balance, validateReversals, withRunningSum, type LedgerEntry } from "../../src/lib/ledger";
import { expectedCash } from "../../src/lib/cash";
import { computePayout } from "../../src/lib/payout";
import { explainCommission } from "../../src/lib/commission";

let db: Db; let s: Scenario;
const sale = (uid: string, member: string, items: object[], discount: number, tip: number, payments: object[], appt: string | null = null) =>
  asUser(db, uid, async () => (await rows<{ pay_sale: string }>(db, "select pay_sale($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb)", [s.bid, appt, s.client, member, JSON.stringify(items), discount, tip, JSON.stringify(payments)]))[0].pay_sale);
const ledger = async (): Promise<(LedgerEntry & { cash_session_id: string | null })[]> =>
  (await rows<any>(db, "select id, seq::int, occurred_at::text, type, direction::int, amount::int, method, account, member_id, description, reversal_of, cash_session_id from ledger_entries order by seq")) as any;

beforeAll(async () => {
  db = await createDb();
  s = await seedScenario(db);
});

describe("venta: ejemplo del SPEC", () => {
  let saleId: string;
  it("Corte 25.000 − descuento 2.500 + propina 5.000, 50 % neto → comisión 11.250 + propina 5.000", async () => {
    saleId = await sale(s.barberA, s.mA, [{ item_type: "service", item_id: s.corte }], 2500, 5000, [{ method: "cash", amount: 27500 }]);
    const c = await rows<any>(db, "select item_type, amount::int, base_amount::int, rule_snapshot from commission_entries where sale_id=$1 order by item_type", [saleId]);
    const svc = c.find((x) => x.item_type === "service");
    const tip = c.find((x) => x.item_type === "tip");
    expect(svc.base_amount).toBe(22500);
    expect(svc.amount).toBe(11250);
    expect(tip.amount).toBe(5000);
    expect(svc.rule_snapshot.rule.scope).toBe("business");
    // el desglose del snapshot que usa la UI cierra con la comisión
    expect(explainCommission(svc.rule_snapshot, svc.amount).at(-1)).toMatchObject({ op: "=", amount: 11250 });
  });
  it("ledger: ingreso 25.000-2.500 y propina separados; el saldo de dinero = total cobrado", async () => {
    const l = await ledger();
    const money = l.filter((e) => e.account !== "payable_staff");
    expect(money.map((e) => [e.type, e.amount])).toEqual([["sale_income", 22500], ["tip_income", 5000]]);
    expect(balance(l, ["cash", "bank", "card_clearing"])).toBe(27500);
    expect(balance(l, ["payable_staff"])).toBe(16250);
  });
  it("no se puede cobrar dos veces la misma cita ni con pagos que no suman", async () => {
    await expect(sale(s.barberA, s.mA, [{ item_type: "service", item_id: s.corte }], 0, 0, [{ method: "cash", amount: 1 }])).rejects.toThrow(/payments_mismatch/);
  });
  it("pago dividido efectivo + tarjeta", async () => {
    await sale(s.recep, s.mB, [{ item_type: "service", item_id: s.corte }, { item_type: "service", item_id: s.barba }], 0, 3000, [{ method: "cash", amount: 20000 }, { method: "card", amount: 23000 }]);
    const l = (await ledger()).filter((e) => e.account !== "payable_staff");
    const last = l.slice(-3).map((e) => [e.type, e.account, e.amount]);
    expect(last).toEqual([["sale_income", "cash", 20000], ["sale_income", "card_clearing", 20000], ["tip_income", "card_clearing", 3000]]);
  });
  it("anular: reversa exacta, comisión negativa, venta marcada, no se borra nada", async () => {
    await expect(asUser(db, s.barberA, () => rows(db, "select void_sale($1,'error')", [saleId]))).rejects.toThrow(/forbidden/);
    await asUser(db, s.owner, () => rows(db, "select void_sale($1,'cobro por error')", [saleId]));
    const l = await ledger();
    expect(validateReversals(l)).toEqual([]);
    const mine = l.filter((e) => e.description.includes("#1"));
    expect(balance(mine)).toBe(0);
    const c = await rows<any>(db, "select amount::int from commission_entries where sale_id=$1", [saleId]);
    expect(c.reduce((a, x) => a + x.amount, 0)).toBe(0);
    await expect(asUser(db, s.owner, () => rows(db, "select void_sale($1,'otra vez')", [saleId]))).rejects.toThrow(/sale_not_paid/);
  });
  it("running sum del libro termina en el saldo", async () => {
    const l = await ledger();
    const r = withRunningSum(l);
    expect(r.at(-1)!.running).toBe(balance(l));
  });
});

describe("regla más específica en SQL (paridad con src/lib)", () => {
  it("miembro+ítem > miembro > ítem > negocio", async () => {
    const mk = (member: string | null, item: string | null, value: number) =>
      asUser(db, s.owner, () => rows(db, "insert into commission_rules(business_id,member_id,item_type,item_id,kind,value) values ($1,$2,'service',$3,'percent',$4)", [s.bid, member, item, value]));
    const amountFor = async () => {
      const id = await sale(s.barberB, s.mB, [{ item_type: "service", item_id: s.barba }], 0, 0, [{ method: "cash", amount: 15000 }]);
      const r = await rows<any>(db, "select amount::int a, rule_snapshot->'rule'->>'scope' sc from commission_entries where sale_id=$1", [id]);
      return [r[0].a, r[0].sc];
    };
    expect(await amountFor()).toEqual([7500, "business"]);
    await mk(null, s.barba, 40);
    expect(await amountFor()).toEqual([6000, "item"]);
    await mk(s.mB, null, 60);
    expect(await amountFor()).toEqual([9000, "member"]);
    await mk(s.mB, s.barba, 70);
    expect(await amountFor()).toEqual([10500, "member_item"]);
  });
});

describe("gastos y cierre de caja", () => {
  it("expected cash = fondo + efectivo del ledger; diferencia exige nota", async () => {
    const sess = (await rows<{ id: string }>(db, "select id from cash_sessions where status='open'"))[0].id;
    await asUser(db, s.recep, () => rows(db, "select record_expense($1,null,8000,'cash','Insumos')", [s.bid]));
    await expect(asUser(db, s.barberA, () => rows(db, "select record_expense($1,null,100,'cash','x')", [s.bid]))).rejects.toThrow(/forbidden/);
    await expect(asUser(db, s.recep, () => rows(db, "select record_expense($1,null,900000,'cash','Grande')", [s.bid]))).rejects.toThrow(/expense_over_limit/);
    const entries = (await ledger()).filter((e) => e.cash_session_id === sess);
    const exp = expectedCash(0, entries).expected;
    const r = await rows<any>(db, "select expected_cash::int from (select coalesce(sum(direction*amount),0) expected_cash from ledger_entries where cash_session_id=$1 and account='cash') x", [sess]);
    expect(r[0].expected_cash).toBe(exp);
    await expect(asUser(db, s.recep, () => rows(db, "select close_cash_session($1,$2,null,null)", [sess, exp - 1000]))).rejects.toThrow(/note_required/);
    const res = await asUser(db, s.recep, () => rows<any>(db, "select close_cash_session($1,$2,null,'faltaron 1000') r", [sess, exp - 1000]));
    expect(res[0].r).toMatchObject({ expected: exp, difference: -1000 });
    await expect(asUser(db, s.recep, () => rows(db, "select close_cash_session($1,0,null,null)", [sess]))).rejects.toThrow(/session_closed/);
  });
  it("la siguiente operación abre una caja nueva automáticamente", async () => {
    await asUser(db, s.owner, () => rows(db, "select record_expense($1,null,500,'transfer','Pago servicio')", [s.bid]));
    expect((await rows(db, "select 1 from cash_sessions where status='open'")).length).toBe(1);
  });
});

describe("liquidación (nómina)", () => {
  it("comisión + fijo prorrateado + ajuste − adelanto = igual que src/lib/payout", async () => {
    await asUser(db, s.owner, () => rows(db, "update member_compensation set pay_type='mixed', fixed_salary=3100000, pay_period='monthly' where member_id=$1", [s.mA]));
    await asUser(db, s.owner, () => rows(db, "select register_advance($1,$2,100000,'cash','Adelanto')", [s.bid, s.mA]));
    const today = (await rows<any>(db, "select (now() at time zone 'America/Bogota')::date::text d, date_trunc('month', now() at time zone 'America/Bogota')::date::text m"))[0];
    const pid = (await asUser(db, s.owner, () => rows<any>(db, "select generate_payout($1,$2,$3,$4) id", [s.bid, s.mA, today.m, today.d])))[0].id;
    await asUser(db, s.owner, () => rows(db, "select add_payout_adjustment($1,20000,'Bono')", [pid]));
    const p = (await rows<any>(db, "select * from payouts where id=$1", [pid]))[0];
    const lines = await rows<any>(db, "select kind, description, amount::int from payout_lines where payout_id=$1", [pid]);
    const ts = computePayout({
      pay_type: "mixed", fixed_salary: 3100000, pay_period: "monthly", period_start: today.m, period_end: today.d,
      commissions: lines.filter((l) => l.kind === "commission").map((l, i) => ({ id: String(i), description: l.description, amount: l.amount })),
      adjustments: lines.filter((l) => l.kind === "adjustment").map((l) => ({ reason: l.description, amount: l.amount })),
      advances: lines.filter((l) => l.kind === "advance").map((l) => ({ reason: l.description, amount: l.amount })),
    });
    expect(Number(p.fixed_amount)).toBe(ts.fixed_amount);
    expect(lines.filter((l) => l.kind === "commission").length).toBeGreaterThan(0); // venta anulada de A: comisión y reversa entran juntas (neto 0)
    expect(Number(p.total)).toBe(ts.total);
    expect(Number(p.commission_total)).toBe(ts.commission_total);
    expect(Number(p.advances)).toBe(100000);
    // estados: solo el dueño aprueba
    await expect(asUser(db, s.admin, () => rows(db, "select approve_payout($1)", [pid]))).rejects.toThrow(/forbidden/);
    await asUser(db, s.owner, () => rows(db, "select approve_payout($1)", [pid]));
    await asUser(db, s.owner, () => rows(db, "select pay_payout($1,'transfer')", [pid]));
    // por pagar al personal de A queda en 0: comisiones + sueldo + ajuste − adelanto − pago
    const l = await ledger();
    expect(balance(l.filter((e) => (e as any).member_id === s.mA), ["payable_staff"])).toBe(0);
    // lo pagado no se vuelve a incluir
    const again = (await asUser(db, s.owner, () => rows<any>(db, "select generate_payout($1,$2,$3,$3) id", [s.bid, s.mA, today.d])))[0].id;
    expect((await rows(db, "select 1 from payout_lines where payout_id=$1 and kind in ('commission','advance')", [again])).length).toBe(0);
  });
});
