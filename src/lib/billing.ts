import Stripe from "stripe";
import { workerRpc } from "@/lib/workerRpc";
import { ADDONS, addonLookupKey, keyFromLookup, type AddonKey } from "@/lib/addons";
import { BILLING_RATES, planPrice } from "@/lib/money";

/** Stripe del servidor. Sin STRIPE_SECRET_KEY la suscripción queda desactivada y la pantalla lo dice. */
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return key ? new Stripe(key) : null;
}
export const billingReady = () => Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_PRICE_ID?.trim());

/** Quita de un texto cualquier clave de Stripe (sk_/rk_/pk_ …) antes de registrarlo. */
export const redact = (m: string) => m.replace(/\b[a-z]{2}_(?:live|test)_[A-Za-z0-9*_]+/gi, "[clave]").slice(0, 300);

/**
 * Convierte un fallo de Stripe (o de nuestra base) en un mensaje claro para el dueño y lo deja en los logs.
 * El log lleva tipo, código, estado HTTP y `requestId` (para buscarlo en el panel de Stripe), el texto del error solo en «solicitud inválida» y redactado:
 * un error de permisos de Stripe incluye el prefijo de la clave.
 */
export function stripeFailure(where: string, e: unknown, ctx: Record<string, string> = {}): { status: number; message: string } {
  const se = e instanceof Stripe.errors.StripeError ? e : null;
  const ref = se?.requestId ? ` (ref. ${se.requestId})` : "";
  console.error(JSON.stringify({
    evt: "stripe_error", where, ...ctx, name: e instanceof Error ? e.name : "unknown",
    ...(se ? { type: se.type, code: se.code, statusCode: se.statusCode, requestId: se.requestId,
               // Solo en «solicitud inválida» (moneda no admitida, parámetro mal puesto): el texto no trae claves, y aun así se redactan por si acaso.
               ...(se instanceof Stripe.errors.StripeInvalidRequestError ? { param: se.param, detail: redact(se.message) } : {}) }
           : { detail: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200) }),
  }));
  if (e instanceof Stripe.errors.StripePermissionError || e instanceof Stripe.errors.StripeAuthenticationError)
    return { status: 502, message: `Hay un problema con la configuración de pagos de Pulso. Ya quedó registrado: escríbenos a soporte y lo arreglamos${ref}.` };
  if (e instanceof Stripe.errors.StripeRateLimitError)
    return { status: 429, message: "Hay muchas solicitudes de pago en este momento. Espera un minuto e intenta de nuevo." };
  if (e instanceof Stripe.errors.StripeConnectionError)
    return { status: 502, message: "No pudimos conectar con Stripe. Revisa tu internet e intenta de nuevo en un momento." };
  if (se)
    return { status: 502, message: `Stripe no pudo completar la operación. Ya quedó registrado: si se repite, escríbenos a soporte${ref}.` };
  return { status: 502, message: "No pudimos completar la operación de pago. Ya quedó registrado: si se repite, escríbenos a soporte." };
}

const LOCAL = Object.keys(BILLING_RATES) as (keyof typeof BILLING_RATES)[];
/** Opciones de moneda (ARS, BRL, EUR) de un precio en USD, calculadas con las tarifas fijas de la app. */
const currencyOptions = (usdCents: number) => Object.fromEntries(LOCAL.map((c) => [c.toLowerCase(), { unit_amount: planPrice(usdCents, c) }]));

/** Garantiza que un precio en USD de Stripe se pueda cobrar también en ARS, BRL y EUR (`currency_options`). Si ya los tiene, no toca nada. */
export async function ensureCurrencyOptions(stripe: Stripe, priceId: string): Promise<void> {
  const p = await stripe.prices.retrieve(priceId, { expand: ["currency_options"] });
  if (p.currency !== "usd" || p.unit_amount === null) return;
  const have = p.currency_options ?? {};
  if (LOCAL.every((c) => c.toLowerCase() in have)) return;
  await stripe.prices.update(priceId, { currency_options: { ...currencyOptions(p.unit_amount), ...Object.fromEntries(Object.entries(have).map(([k, v]) => [k, { unit_amount: v.unit_amount ?? undefined }])) } as Stripe.PriceUpdateParams["currency_options"] });
}

/** Precio mensual de Stripe de un complemento. Se busca por `lookup_key` y, si no existe, se crea la primera vez (ya con ARS, BRL y EUR). */
export async function addonPriceId(stripe: Stripe, key: AddonKey): Promise<string> {
  const lookup = addonLookupKey(key);
  const found = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
  if (found.data[0]) { await ensureCurrencyOptions(stripe, found.data[0].id); return found.data[0].id; }
  const a = ADDONS.find((x) => x.key === key)!;
  const created = await stripe.prices.create({
    currency: "usd", unit_amount: a.price, recurring: { interval: "month" }, lookup_key: lookup,
    currency_options: currencyOptions(a.price) as Stripe.PriceCreateParams["currency_options"],
    product_data: { name: `Pulso · ${a.name}`, metadata: { addon: key } },
  });
  return created.id;
}
/** Complementos que trae una suscripción de Stripe, leídos de los `lookup_key` de sus precios. */
export const addonsOfSubscription = (sub: Stripe.Subscription): AddonKey[] =>
  (sub.items?.data ?? []).map((i) => keyFromLookup(i.price?.lookup_key)).filter((k): k is AddonKey => k !== null);

/** RPC de facturación con el cliente anon + CRON_SECRET (se valida en SQL contra vault, como la cola de mensajes). */
export function billingRpc() {
  const rpc = workerRpc("billing");
  return {
    async linkCustomer(business: string, customer: string) {
      const { error } = await rpc("billing_link_customer", { p_business: business, p_customer: customer });
      if (error) throw new Error(error.message);
    },
    async sync(sub: Stripe.Subscription) {
      const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      // Las versiones nuevas de la API del periodo viven en el ítem; las viejas, en la suscripción.
      const end = (sub as unknown as { current_period_end?: number }).current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
      const iso = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString() : null);
      const args = { p_customer: customer, p_subscription: sub.id, p_status: sub.status,
        p_period_end: iso(end), p_trial_end: iso(sub.trial_end), p_cancel: sub.cancel_at_period_end };
      let { data, error } = await rpc("billing_sync", { ...args, p_addons: addonsOfSubscription(sub) });
      // Si la migración 0029 aún no está aplicada, la función vieja no conoce los complementos: se sincroniza sin ellos.
      if (error && /p_addons|schema cache|could not find/i.test(error.message)) ({ data, error } = await rpc("billing_sync", args));
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
  };
}
