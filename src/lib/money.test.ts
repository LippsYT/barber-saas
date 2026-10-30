import { describe, it, expect } from "vitest";
import { formatMoney, formatSigned, toCents, centsToInput } from "./money";

describe("money USD (centavos)", () => {
  it("formatea US$ con 2 decimales", () => {
    expect(formatMoney(2500)).toBe("US$ 25.00");
    expect(formatMoney(123456)).toBe("US$ 1,234.56");
    expect(formatMoney(0)).toBe("US$ 0.00");
    expect(formatMoney(-1200)).toBe("−US$ 12.00");
    expect(formatMoney(800, "COP")).toBe("US$ 8.00");
  });
  it("con signo", () => { expect(formatSigned(2500)).toBe("+ US$ 25.00"); expect(formatSigned(-1200)).toBe("− US$ 12.00"); });
  it("dólares → centavos", () => {
    expect(toCents("25")).toBe(2500); expect(toCents("25.5")).toBe(2550); expect(toCents("25,50")).toBe(2550);
    expect(toCents("0.1")).toBe(10); expect(toCents("")).toBe(0); expect(toCents("abc")).toBe(0);
    expect(centsToInput(2550)).toBe("25.50");
  });
});
