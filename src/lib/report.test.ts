import { describe, it, expect } from "vitest";
import { buildReportPdf, lastWeek } from "./report";

describe("informe semanal", () => {
  it("toma los 7 días completos anteriores a hoy en la zona del negocio", () => {
    const p = lastWeek("America/Guayaquil", Date.parse("2026-11-02T15:00:00Z")); // lunes 10:00 en Guayaquil
    expect(p.from).toBe("2026-10-26T05:00:00.000Z");
    expect(p.to).toBe("2026-11-02T05:00:00.000Z");
    expect(p.label).toBe("26 oct 2026 – 1 nov 2026");
  });
  it("genera un PDF válido con acentos y sin datos", async () => {
    const pdf = await buildReportPdf({ name: "Barbería Ñandú", currency: "USD" }, lastWeek("America/Guayaquil"), {
      income: 123450, tips: 5000, expenses: 20000, new_clients: 3, appointments: { completed: 12, cancelled: 2 },
      top_services: [{ name: "Corte clásico", n: 8, total: 80000 }], by_barber: [{ name: "Andrés", n: 12 }],
    });
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1500);
    const empty = await buildReportPdf({ name: "X", currency: "USD" }, lastWeek("America/Guayaquil"), { income: 0, tips: 0, expenses: 0, new_clients: 0, appointments: {}, top_services: [], by_barber: [] });
    expect(empty.length).toBeGreaterThan(1000);
  });
});
