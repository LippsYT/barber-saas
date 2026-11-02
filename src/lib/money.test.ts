import { describe, it, expect } from "vitest";
import { formatMoney, formatSigned, formatUsd, setCurrency, toCents, centsToInput } from "./money";

describe("money USD (centavos)", () => {
  it("formatea US$ con 2 decimales", () => {
    expect(formatMoney(2500)).toBe("US$ 25.00");
    expect(formatMoney(123456)).toBe("US$ 1,234.56");
    expect(formatMoney(0)).toBe("US$ 0.00");
    expect(formatMoney(-1200)).toBe("−US$ 12.00");
    expect(formatMoney(800, "XXX")).toBe("US$ 8.00");
  });
  it("con signo", () => { expect(formatSigned(2500)).toBe("+ US$ 25.00"); expect(formatSigned(-1200)).toBe("− US$ 12.00"); });
  it("dólares → centavos", () => {
    expect(toCents("25")).toBe(2500); expect(toCents("25.5")).toBe(2550); expect(toCents("25,50")).toBe(2550);
    expect(toCents("0.1")).toBe(10); expect(toCents("")).toBe(0); expect(toCents("abc")).toBe(0);
    expect(centsToInput(2550)).toBe("25.50");
  });
});

describe("moneda por negocio", () => {
  it("pesos argentinos", () => {
    expect(formatMoney(2500000, "ARS")).toBe("$ 25.000,00");
    expect(formatMoney(-150000, "ARS")).toBe("−$ 1.500,00");
  });
  it("sin decimales en COP y CLP", () => { expect(formatMoney(1500000, "COP")).toBe("$ 15.000"); });
  it("setCurrency fija la moneda por defecto; formatUsd no la sigue", () => {
    setCurrency("ARS");
    expect(formatMoney(100000)).toBe("$ 1.000,00");
    expect(formatUsd(1500)).toBe("US$ 15.00");
    setCurrency("ZZZ");
    expect(formatMoney(2500)).toBe("US$ 25.00");
  });
});
