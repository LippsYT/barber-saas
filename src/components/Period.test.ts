import { describe, it, expect } from "vitest";
import { periodLabel, shiftPeriod, periodRange } from "./Period";

describe("selector de periodo", () => {
  it("mueve un día, una semana o un mes, también entre años", () => {
    expect(shiftPeriod("day", "2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftPeriod("week", "2026-11-04", -1)).toBe("2026-10-26");
    expect(shiftPeriod("week", "2026-11-04", 1)).toBe("2026-11-09");
    expect(shiftPeriod("month", "2026-11-15", -1)).toBe("2026-10-01");
    expect(shiftPeriod("month", "2026-01-31", -1)).toBe("2025-12-01");
    expect(shiftPeriod("month", "2026-12-10", 1)).toBe("2027-01-01");
  });
  it("dice en palabras lo que se está viendo", () => {
    expect(periodLabel("day", "2026-11-01")).toMatch(/^Domingo 1 nov 2026$/i);
    expect(periodLabel("week", "2026-11-04")).toBe("2 nov – 8 nov 2026");
    expect(periodLabel("month", "2026-11-15")).toBe("Noviembre 2026");
  });
  it("el rango del mes empieza el día 1 y termina antes del 1 del siguiente", () => {
    const r = periodRange("month", "2026-11-15", "America/Guayaquil");
    expect([r.start, r.end]).toEqual(["2026-11-01", "2026-12-01"]);
  });
});
