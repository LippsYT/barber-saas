import { describe, it, expect } from "vitest";
import { toE164, waHref } from "./phone";

describe("toE164", () => {
  it("número local ecuatoriano con 0", () => expect(toE164("0991234567")).toBe("+593991234567"));
  it("con espacios y guiones", () => expect(toE164(" 099 123-4567 ")).toBe("+593991234567"));
  it("sin 0 inicial", () => expect(toE164("991234567")).toBe("+593991234567"));
  it("ya con código sin +", () => expect(toE164("593991234567")).toBe("+593991234567"));
  it("respeta + de otro país", () => expect(toE164("+57 300 123 4567")).toBe("+573001234567"));
  it("prefijo 00", () => expect(toE164("0057 3001234567")).toBe("+573001234567"));
  it("internacional sin + (Argentina)", () => expect(toE164("5491157604074")).toBe("+5491157604074"));
  it("vacío", () => { expect(toE164("")).toBeNull(); expect(toE164(null)).toBeNull(); });
  it("código de país del negocio", () => expect(toE164("3001234567", "57")).toBe("+573001234567"));
  it("idempotente", () => expect(toE164(toE164("0991234567"))).toBe("+593991234567"));
});

describe("waHref", () => {
  it("usa E.164 sin +", () => expect(waHref("0991234567")).toBe("https://wa.me/593991234567"));
  it("vacío", () => expect(waHref("")).toBe(""));
});
