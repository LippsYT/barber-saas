import { describe, it, expect } from "vitest";
import { computePayout, proratedFixed } from "./payout";

describe("sueldo fijo prorrateado", () => {
  it("mes completo", () => expect(proratedFixed(3000000, "monthly", "2026-10-01", "2026-10-31")).toMatchObject({ amount: 3000000, note: "período completo" }));
  it("medio octubre: 15/31 días", () => expect(proratedFixed(3100000, "monthly", "2026-10-01", "2026-10-15").amount).toBe(1500000));
  it("semanal 3 días", () => expect(proratedFixed(700000, "weekly", "2026-10-26", "2026-10-28").amount).toBe(300000));
  it("no paga más de un período", () => expect(proratedFixed(700000, "weekly", "2026-10-01", "2026-10-31").amount).toBe(700000));
});

describe("liquidación", () => {
  const base = { period_start: "2026-10-01", period_end: "2026-10-31", pay_period: "monthly" as const, fixed_salary: 1500000 };
  it("mixto: comisión + fijo + ajustes − adelantos", () => {
    const r = computePayout({ ...base, pay_type: "mixed", commissions: [{ id: "1", description: "a", amount: 11250 }, { id: "2", description: "b", amount: 5000 }], adjustments: [{ reason: "bono", amount: 20000 }, { reason: "multa", amount: -5000 }], advances: [{ reason: "adelanto", amount: 100000 }] });
    expect(r.total).toBe(16250 + 1500000 + 15000 - 100000);
    expect(r.lines.at(-1)).toMatchObject({ op: "=", amount: r.total });
    // el acumulado de la última línea de detalle coincide con el total
    expect(r.lines.at(-2)!.running).toBe(r.total);
  });
  it("solo comisión ignora sueldo fijo; solo fijo ignora comisiones", () => {
    expect(computePayout({ ...base, pay_type: "commission", commissions: [{ id: "1", description: "a", amount: 100 }], adjustments: [], advances: [] }).total).toBe(100);
    expect(computePayout({ ...base, pay_type: "fixed", commissions: [{ id: "1", description: "a", amount: 100 }], adjustments: [], advances: [] }).total).toBe(1500000);
  });
  it("comisiones negativas (anulaciones) restan", () => {
    expect(computePayout({ ...base, pay_type: "commission", commissions: [{ id: "1", description: "a", amount: 500 }, { id: "2", description: "rev", amount: -500 }], adjustments: [], advances: [] }).total).toBe(0);
  });
});
