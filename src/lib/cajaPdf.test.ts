import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { buildCajaPdf, pdfMoney, type CajaPdfData } from "./cajaPdf";
import { teamOfDay } from "./cajaTeam";

const team = teamOfDay(
  [{ id: "a", name: "Mateo Rivas", services: 12, income: 20000, tips: 1000 }, { id: "b", name: "Diego Cedeño", services: 5, income: 11000, tips: 500 }],
  [
    { member_id: "a", item_type: "service", amount: 10000 }, { member_id: "a", item_type: "tip", amount: 1000 },
    { member_id: "b", item_type: "service", amount: 5500 }, { member_id: "b", item_type: "tip", amount: 500 },
  ],
  [{ member_id: "b", amount: 2000 }, { member_id: "c", amount: 1500 }],
  { c: "Camila Vera" },
  [
    { member_id: "a", name: "Servicio premium", qty: 3 }, { member_id: "a", name: "Servicio básico", qty: 2 }, { member_id: "a", name: "Servicio premium", qty: 1 },
    { member_id: "a", name: "Servicio de cejas", qty: 4 }, { member_id: "b", name: "Servicio de ondulaciones permanente", qty: 1 },
  ],
);

describe("equipo del día", () => {
  it("suma comisión y propinas y resta el adelanto", () => {
    const b = team.find((r) => r.id === "b")!;
    expect(b).toMatchObject({ commission: 5500, tips: 500, advances: 2000, owed: 4000 });
    expect(team.find((r) => r.id === "a")!.owed).toBe(11000);
  });
  it("cuenta cuántos servicios de cada tipo hizo cada uno, el más hecho primero", () => {
    expect(team.find((r) => r.id === "a")!.items).toEqual([
      { name: "Servicio de cejas", qty: 4 }, { name: "Servicio premium", qty: 4 }, { name: "Servicio básico", qty: 2 },
    ]);
    expect(team.find((r) => r.id === "c")!.items).toEqual([]);
  });
  it("quien solo pidió adelanto queda en negativo", () => {
    expect(team.find((r) => r.id === "c")).toMatchObject({ name: "Camila Vera", owed: -1500 });
  });
});

describe("pdf de caja", () => {
  it("formatea dinero con signo simple", () => {
    expect(pdfMoney(-1250)).toBe("-US$ 12.50");
  });
  it("genera un PDF válido, también con muchas filas (varias páginas)", async () => {
    const data: CajaPdfData = {
      business: "Lumos Studio", dayLabel: "Domingo, 1 de noviembre", locked: false,
      serviceIncome: 37100, tips: 2300, income: 39400, expenses: 11200, net: 28200,
      byMethod: { cash: { in: 18400, out: 8200 }, transfer: { in: 21000, out: 3000 } },
      services: Array.from({ length: 60 }, (_, i) => ({ name: `Servicio número ${i + 1} con nombre largo para probar el recorte ✂`, qty: 1 + (i % 3), unitPrice: 1000, total: (1 + (i % 3)) * 1000 })),
      expensesList: [{ description: "Navajas y cuchillas de repuesto", method: "cash", amount: 4500 }],
      team, expectedCash: 8200, close: null,
    };
    const bytes = await buildCajaPdf(data);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    if (process.env.PDF_OUT) fs.writeFileSync(process.env.PDF_OUT, bytes);
    const short = await buildCajaPdf({ ...data, services: data.services.slice(0, 5), team: null, close: { counted: 8200, difference: 0 }, locked: true });
    expect(short.length).toBeGreaterThan(1000);
    if (process.env.PDF_OUT) fs.writeFileSync(process.env.PDF_OUT.replace(".pdf", "-corto.pdf"), short);
  });
});
