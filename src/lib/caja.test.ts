import { describe, expect, it } from "vitest";
import { closeDrawer, periodReport, serviceBreakdown, settleAccounts } from "./caja";

const corte = (n: number, price = 1200) => Array.from({ length: n }, () => ({ name: "Corte", unitPrice: price }));
const nino = (n: number) => Array.from({ length: n }, () => ({ name: "Corte niño", unitPrice: 800 }));

describe("desglose del día por servicio", () => {
  it("arma la frase de hoy con el precio de cada cita", () => {
    const r = serviceBreakdown([...corte(10), ...nino(5)]);
    expect(r.total).toBe(10 * 1200 + 5 * 800);
    expect(r.sentence).toBe("10 × Corte US$ 12.00 · 5 × Corte niño US$ 8.00");
    expect(r.lines.map((l) => [l.name, l.qty, l.unitPrice, l.total])).toEqual([
      ["Corte", 10, 1200, 12000],
      ["Corte niño", 5, 800, 4000],
    ]);
  });

  it("no mezcla el mismo nombre si el precio reservado era distinto", () => {
    const r = serviceBreakdown([{ name: "Corte", unitPrice: 1200 }, { name: "Corte", unitPrice: 1500, qty: 2 }]);
    expect(r.lines.map((l) => [l.unitPrice, l.qty, l.total])).toEqual([[1500, 2, 3000], [1200, 1, 1200]]);
    expect(r.total).toBe(4200);
  });

  it("sin servicios cobrados no inventa un total", () => {
    expect(serviceBreakdown([]).total).toBe(0);
    expect(serviceBreakdown([]).sentence).toMatch(/no hay servicios/i);
  });
});

describe("cierre de caja", () => {
  const moves = [
    { bucket: "sales" as const, method: "cash" as const, amount: 12000 },
    { bucket: "sales" as const, method: "transfer" as const, amount: 4000 },
    { bucket: "tips" as const, method: "cash" as const, amount: 500 },
    { bucket: "expenses" as const, method: "cash" as const, amount: -1400 },
    { bucket: "advances" as const, method: "cash" as const, amount: -1000 },
    { bucket: "expenses" as const, method: "transfer" as const, amount: -600 },
  ];

  it("el efectivo esperado ignora la transferencia y explica cada línea", () => {
    const r = closeDrawer(moves, 10100);
    expect(r.expected).toBe(12000 + 500 - 1400 - 1000);
    expect(r.lines.map((l) => [l.label, l.amount])).toEqual([
      ["Servicios en efectivo", 12000],
      ["Propinas en efectivo", 500],
      ["Gastos en efectivo", -1400],
      ["Adelantos en efectivo", -1000],
    ]);
    expect(r.lines.reduce((s, l) => s + l.amount, 0)).toBe(r.expected);
    expect(r.difference).toBe(0);
    expect(r.needsNote).toBe(false);
  });

  it("si no cuadra, la diferencia es contado menos esperado y pide una nota", () => {
    const r = closeDrawer(moves, 10000);
    expect(r.difference).toBe(-100);
    expect(r.needsNote).toBe(true);
  });
});

describe("reportes", () => {
  it("ingreso, gastos y neto, partido por forma de pago, servicio y barbero", () => {
    const r = periodReport(
      [
        { id: "1", barberId: "k", barberName: "Kevin", income: 12000, tip: 500, items: [{ name: "Corte", unitPrice: 1200, qty: 10, lineTotal: 12000 }], payments: [{ method: "cash", amount: 12500 }] },
        { id: "2", barberId: "a", barberName: "Andrés", income: 4000, tip: 0, items: [{ name: "Corte niño", unitPrice: 800, qty: 5, lineTotal: 4000 }], payments: [{ method: "transfer", amount: 4000 }] },
      ],
      [{ amount: 1400, method: "cash", concept: "Insumos" }],
    );
    expect(r.income).toBe(16500);
    expect(r.tips).toBe(500);
    expect(r.expenses).toBe(1400);
    expect(r.net).toBe(15100);
    expect(r.byMethod.cash).toEqual({ in: 12500, out: 1400, net: 11100 });
    expect(r.byMethod.transfer.net).toBe(4000);
    expect(r.byService.map((s) => s.name)).toEqual(["Corte", "Corte niño"]);
    expect(r.byBarber.map((b) => [b.name, b.income, b.services])).toEqual([["Kevin", 12000, 10], ["Andrés", 4000, 5]]);
  });
});

describe("liquidación menos adelantos", () => {
  it("comisión menos el adelanto de hoy", () => {
    const r = settleAccounts({
      commissions: [{ id: "1", description: "3 × Corte", amount: 3600 }],
      advances: [{ id: "a", note: "Adelanto de hoy", amount: 1000 }],
      carriedIn: 0,
    });
    expect(r.toPay).toBe(2600);
    expect(r.carryOut).toBe(0);
    expect(r.lines.at(-1)).toMatchObject({ op: "=", label: "A pagar", amount: 2600 });
  });

  it("si el adelanto es mayor, hoy se paga cero y el resto se arrastra", () => {
    const hoy = settleAccounts({
      commissions: [{ id: "1", description: "Corte", amount: 600 }],
      advances: [{ id: "a", note: "Adelanto de hoy", amount: 1000 }],
      carriedIn: 0,
    });
    expect(hoy.toPay).toBe(0);
    expect(hoy.carryOut).toBe(400);
    expect(hoy.toPay - hoy.carryOut).toBe(600 - 1000);

    const siguiente = settleAccounts({
      commissions: [{ id: "2", description: "Cortes de la semana", amount: 2000 }],
      advances: [],
      carriedIn: hoy.carryOut,
    });
    expect(siguiente.toPay).toBe(1600);
    expect(siguiente.carryOut).toBe(0);
    expect(siguiente.lines.map((l) => l.label)).toContain("Adelanto que venía de antes");
    expect(siguiente.toPay - siguiente.carryOut).toBe(2000 - 400);
  });

  it("varios adelantos se restan todos y cada uno se puede leer", () => {
    const r = settleAccounts({
      commissions: [{ id: "1", description: "Corte", amount: 5000 }, { id: "2", description: "Barba", amount: -500 }],
      advances: [{ id: "a", note: "Lunes", amount: 1000 }, { id: "b", note: "Martes", amount: 1500 }],
      carriedIn: 200,
      fixed: 0,
    });
    expect(r.commissionTotal).toBe(4500);
    expect(r.toPay).toBe(4500 - 1000 - 1500 - 200);
    expect(r.lines.filter((l) => l.op === "−").map((l) => l.amount)).toEqual([1000, 1500, 200]);
  });
});
