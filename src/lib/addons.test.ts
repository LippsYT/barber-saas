import { describe, it, expect } from "vitest";
import { ADDONS, BASE_PRICE, addonLookupKey, keyFromLookup, monthlyTotal } from "./addons";

describe("complementos", () => {
  it("el total es el plan base más cada complemento elegido", () => {
    expect(monthlyTotal([])).toBe(BASE_PRICE);
    expect(monthlyTotal(["whatsapp"])).toBe(BASE_PRICE + 1500);
    expect(monthlyTotal(["whatsapp", "informes", "x"])).toBe(BASE_PRICE + 1500 + 1000);
  });
  it("la clave de Stripe va y viene sin perderse", () => {
    for (const a of ADDONS) expect(keyFromLookup(addonLookupKey(a.key))).toBe(a.key);
    expect(keyFromLookup("otro_precio")).toBeNull();
    expect(keyFromLookup("pulso_addon_inventado")).toBeNull();
    expect(keyFromLookup(null)).toBeNull();
  });
  it("lo que depende de otro complemento lo declara y existe", () => {
    for (const a of ADDONS) if (a.needs) expect(ADDONS.some((x) => x.key === a.needs)).toBe(true);
  });
});
