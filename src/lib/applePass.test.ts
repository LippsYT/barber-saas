import { describe, it, expect } from "vitest";
import { applePassBody, applePassEnabled, createApplePass } from "./applePass";
describe("Apple Wallet (WalletWallet)", () => {
  const p = { id: "a1", business: "House Davidson", startsAt: "2026-11-02T15:00:00Z", timezone: "America/Guayaquil", service: "servicio plata", barber: "Andrés", address: "Av. X", url: "https://x.test/hd/cita/t" };
  it("se activa solo con la env", () => { expect(applePassEnabled({})).toBe(false); expect(applePassEnabled({ WALLETWALLET_API_KEY: "k" })).toBe(true); });
  it("cuerpo válido: hora local, QR al link y vence 24 h después", () => {
    const b = applePassBody(p);
    expect(b.primaryFields[0].value).toMatch(/10:00/);
    expect(b.barcodeValue).toBe(p.url);
    expect(b.expirationDate).toBe("2026-11-03T15:00:00.000Z");
  });
  it("decodifica el .pkpass y propaga errores", async () => {
    const ok = (async () => new Response(JSON.stringify({ applePass: Buffer.from("PK").toString("base64") }), { status: 200 })) as unknown as typeof fetch;
    expect(Buffer.from((await createApplePass(p, "k", ok)).pkpass).toString()).toBe("PK");
    const bad = (async () => new Response(JSON.stringify({ error: "nope" }), { status: 401 })) as unknown as typeof fetch;
    await expect(createApplePass(p, "k", bad)).rejects.toThrow(/401/);
  });
});
