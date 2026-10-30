import { describe, it, expect } from "vitest";
import { balance, validateReversals, withRunningSum, type LedgerEntry } from "./ledger";
import { closeCash, denominationsTotal, expectedCash } from "./cash";
import { splitPayments, saleTotals } from "./sale";

let n = 0;
const E = (o: Partial<LedgerEntry>): LedgerEntry => ({ id: `e${String(++n).padStart(3, "0")}`, occurred_at: `2026-10-29T10:${String(n).padStart(2, "0")}:00Z`, type: "sale_income", direction: 1, amount: 0, account: "cash", description: "", ...o });

describe("ledger (ejemplo del SPEC)", () => {
  const e1 = E({ amount: 25000, description: "Venta #102 Corte" });
  const e2 = E({ type: "tip_income", amount: 5000, description: "Propina #102" });
  const e3 = E({ type: "expense", direction: -1, amount: 12000, description: "Gasto insumos" });
  const e4 = E({ type: "void_reversal", direction: -1, amount: 25000, reversal_of: e1.id, description: "Anulación #102" });
  it("acumulados 25.000, 30.000, 18.000, −7.000", () => {
    const r = withRunningSum([e4, e2, e1, e3]);
    expect(r.map((x) => x.running)).toEqual([25000, 30000, 18000, -7000]);
    expect(balance([e1, e2, e3, e4])).toBe(-7000);
    expect(r.at(-1)!.running).toBe(balance([e1, e2, e3, e4]));
  });
  it("payable_staff no cuenta como dinero", () => {
    const acc = E({ type: "commission_accrual", account: "payable_staff", amount: 999 });
    expect(balance([e1, acc], ["cash", "bank", "card_clearing"])).toBe(25000);
  });
  it("valida reversos", () => {
    expect(validateReversals([e1, e4])).toEqual([]);
    expect(validateReversals([e4])).toHaveLength(1);
    expect(validateReversals([e1, { ...e4, amount: 1 }])).toHaveLength(1);
  });
});

describe("cierre de caja", () => {
  const entries = [
    E({ amount: 50000 }), E({ type: "tip_income", amount: 5000 }),
    E({ type: "expense", direction: -1, amount: 8000 }), E({ type: "payout", direction: -1, amount: 20000 }),
    E({ account: "card_clearing", amount: 40000 }),
  ];
  it("esperado = fondo + ventas + propinas − gastos − pagos", () => {
    const x = expectedCash(100000, entries);
    expect(x.expected).toBe(100000 + 50000 + 5000 - 8000 - 20000);
    expect(x.lines.map((l) => l.amount)).toEqual([50000, 5000, -8000, -20000]);
  });
  it("diferencia y nota obligatoria", () => {
    expect(closeCash(127000, 127000)).toMatchObject({ difference: 0, needsNote: false });
    expect(closeCash(127000, 120000)).toMatchObject({ difference: -7000, needsNote: true });
    expect(closeCash(127000, 130000).difference).toBe(3000);
  });
  it("denominaciones", () => expect(denominationsTotal({ "2000": 2, "100": 5, "25": 0 })).toBe(4500));
});

describe("venta y pagos divididos", () => {
  it("totales", () => expect(saleTotals([{ qty: 1, unit_price: 25000 }, { qty: 2, unit_price: 10000 }], 5000, 3000)).toEqual({ subtotal: 45000, discount: 5000, tip: 3000, total: 43000 }));
  it("pagos cubren ingreso primero, luego propina", () => {
    const p = splitPayments([{ method: "cash", amount: 20000 }, { method: "card", amount: 10000 }], 25000, 5000);
    expect(p).toEqual([
      { method: "cash", kind: "income", amount: 20000 },
      { method: "card", kind: "income", amount: 5000 },
      { method: "card", kind: "tip", amount: 5000 },
    ]);
  });
  it("rechaza pagos que no suman", () => expect(() => splitPayments([{ method: "cash", amount: 1 }], 25000, 0)).toThrow());
});
