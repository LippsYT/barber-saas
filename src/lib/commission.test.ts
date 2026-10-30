import { describe, it, expect } from "vitest";
import { allocateDiscount, computeLineCommission, explainCommission, pickRule, type CommissionRule } from "./commission";

const R = (o: Partial<CommissionRule> & { id: string }): CommissionRule => ({ member_id: null, item_type: "service", item_id: null, kind: "percent", value: 50, base: "net_of_discount", ...o });
const line = { item_type: "service" as const, item_id: "corte", member_id: "juan", description: "Corte clásico", qty: 1, unit_price: 25000, discount: 2500 };

describe("regla más específica", () => {
  const business = R({ id: "a", value: 30 });
  const item = R({ id: "b", item_id: "corte", value: 40 });
  const member = R({ id: "c", member_id: "juan", value: 50 });
  const both = R({ id: "d", member_id: "juan", item_id: "corte", value: 60 });
  it("miembro+ítem > miembro > ítem > negocio", () => {
    expect(pickRule([business, item, member, both], line, "2026-10-01")?.rule.id).toBe("d");
    expect(pickRule([business, item, member], line, "2026-10-01")?.rule.id).toBe("c");
    expect(pickRule([business, item], line, "2026-10-01")?.rule.id).toBe("b");
    expect(pickRule([business], line, "2026-10-01")?.rule.id).toBe("a");
  });
  it("ignora reglas de otro barbero/ítem/tipo y fuera de vigencia", () => {
    expect(pickRule([R({ id: "x", member_id: "pedro" }), R({ id: "y", item_id: "barba" }), R({ id: "z", item_type: "product" })], line, "2026-10-01")).toBeNull();
    expect(pickRule([R({ id: "v", valid_to: "2026-09-30" })], line, "2026-10-01")).toBeNull();
    expect(pickRule([R({ id: "v", valid_from: "2026-10-02" })], line, "2026-10-01")).toBeNull();
  });
  it("empate: vigencia más reciente gana", () => {
    expect(pickRule([R({ id: "old", valid_from: "2026-01-01" }), R({ id: "new", valid_from: "2026-06-01" })], line, "2026-10-01")?.rule.id).toBe("new");
  });
});

describe("cálculo de comisión (ejemplo del SPEC)", () => {
  it("25.000 − 2.500 = 22.500 × 50 % = 11.250", () => {
    const { amount, snapshot } = computeLineCommission(line, [R({ id: "m", member_id: "juan" })], "2026-10-01");
    expect(snapshot.base_amount).toBe(22500);
    expect(amount).toBe(11250);
    const ex = explainCommission(snapshot, amount);
    expect(ex.map((l) => l.amount)).toContain(11250);
    expect(ex.at(-1)).toMatchObject({ op: "=", amount: 11250 });
  });
  it("base bruta ignora descuento", () => {
    expect(computeLineCommission(line, [R({ id: "m", base: "gross" })], "2026-10-01").amount).toBe(12500);
  });
  it("monto fijo por unidad", () => {
    expect(computeLineCommission({ ...line, qty: 3, unit_price: 1000, discount: 0 }, [R({ id: "f", kind: "fixed", value: 700 })], "2026-10-01").amount).toBe(2100);
  });
  it("redondeo half-up y porcentajes decimales", () => {
    expect(computeLineCommission({ ...line, unit_price: 1001, discount: 0 }, [R({ id: "m", value: 50 })], "2026-10-01").amount).toBe(501);
    expect(computeLineCommission({ ...line, unit_price: 10000, discount: 0 }, [R({ id: "m", value: 12.5 })], "2026-10-01").amount).toBe(1250);
  });
  it("propina 5.000 × 100 % = 5.000 y total de la venta 16.250", () => {
    const rules = [R({ id: "m", member_id: "juan" }), R({ id: "t", item_type: "tip", value: 100, base: "gross" })];
    const s = computeLineCommission(line, rules, "2026-10-01").amount;
    const t = computeLineCommission({ item_type: "tip", item_id: null, member_id: "juan", description: "Propina", qty: 1, unit_price: 5000, discount: 0 }, rules, "2026-10-01").amount;
    expect(t).toBe(5000);
    expect(s + t).toBe(16250);
  });
  it("sin regla → 0 con snapshot null", () => {
    const r = computeLineCommission(line, [], "2026-10-01");
    expect(r.amount).toBe(0);
    expect(r.snapshot.rule).toBeNull();
  });
  it("snapshot conserva la regla aunque cambie después", () => {
    const rule = R({ id: "m", value: 50 });
    const { snapshot, amount } = computeLineCommission(line, [rule], "2026-10-01");
    rule.value = 10;
    expect(snapshot.rule?.value).toBe(50);
    expect(explainCommission(snapshot, amount).some((l) => l.text === "50 %")).toBe(true);
  });
});

describe("allocateDiscount", () => {
  it("suma exacta y proporcional", () => {
    const a = allocateDiscount([10000, 5000, 5000], 1001);
    expect(a.reduce((x, y) => x + y, 0)).toBe(1001);
    expect(a[0]).toBeGreaterThanOrEqual(a[1]);
  });
  it("no excede el bruto", () => {
    expect(allocateDiscount([100, 0], 500)).toEqual([100, 0]);
    expect(allocateDiscount([100], 0)).toEqual([0]);
  });
});
