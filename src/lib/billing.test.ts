import { describe, it, expect, vi, afterEach } from "vitest";
import Stripe from "stripe";
import { stripeFailure } from "./billing";

afterEach(() => vi.restoreAllMocks());

/** Texto parecido al de Stripe cuando a una clave restringida le falta un permiso: trae el prefijo de la clave. */
const LEAK = "The provided key 'rk_live_FAKE****' does not have the required permissions";

describe("stripeFailure", () => {
  it("permisos faltantes: mensaje claro al dueño con referencia y log sin el texto de Stripe", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const e = new Stripe.errors.StripePermissionError({ type: "invalid_request_error", message: LEAK, requestId: "req_abc123" } as never);
    const f = stripeFailure("billing:checkout", e, { business: "b1" });
    expect(f.status).toBe(502);
    expect(f.message).toContain("configuración de pagos");
    expect(f.message).toContain("req_abc123");
    expect(f.message).not.toContain("rk_live");
    const line = String(log.mock.calls[0][0]);
    expect(line).not.toContain("rk_live");
    expect(JSON.parse(line)).toMatchObject({ evt: "stripe_error", where: "billing:checkout", business: "b1", type: "StripePermissionError", requestId: "req_abc123" });
  });
  it("límite de peticiones y conexión caída tienen mensajes propios", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(stripeFailure("x", new Stripe.errors.StripeRateLimitError({ type: "invalid_request_error", message: "m" } as never))).toMatchObject({ status: 429 });
    expect(stripeFailure("x", new Stripe.errors.StripeConnectionError({ type: "api_error", message: "m" } as never)).message).toContain("conectar con Stripe");
  });
  it("un error que no es de Stripe también da un mensaje claro y queda en el log", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const f = stripeFailure("billing:addon", new Error("boom"));
    expect(f).toMatchObject({ status: 502 });
    expect(f.message).toContain("Ya quedó registrado");
    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({ where: "billing:addon", detail: "boom" });
  });
});

import { ensureCurrencyOptions } from "./billing";
describe("ensureCurrencyOptions", () => {
  const fake = (price: Record<string, unknown>) => {
    const update = vi.fn(async () => ({}));
    return { stripe: { prices: { retrieve: vi.fn(async () => price), update } } as never, update };
  };
  it("agrega ARS, BRL y EUR a un precio en USD que no los tiene", async () => {
    const { stripe, update } = fake({ currency: "usd", unit_amount: 1500, currency_options: {} });
    await ensureCurrencyOptions(stripe, "price_1");
    expect(update).toHaveBeenCalledWith("price_1", { currency_options: { ars: { unit_amount: 2100000 }, brl: { unit_amount: 7900 }, eur: { unit_amount: 1200 } } });
  });
  it("no toca un precio que ya los tiene", async () => {
    const { stripe, update } = fake({ currency: "usd", unit_amount: 1500, currency_options: { ars: { unit_amount: 1 }, brl: { unit_amount: 1 }, eur: { unit_amount: 1 } } });
    await ensureCurrencyOptions(stripe, "price_1");
    expect(update).not.toHaveBeenCalled();
  });
  it("ignora precios que no son en USD", async () => {
    const { stripe, update } = fake({ currency: "eur", unit_amount: 1200 });
    await ensureCurrencyOptions(stripe, "price_1");
    expect(update).not.toHaveBeenCalled();
  });
});
