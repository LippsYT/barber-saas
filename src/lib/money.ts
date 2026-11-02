/**
 * Montos como ENTEROS en centavos (bigint en la DB): 2500 = 25.00 de la moneda del negocio.
 * Cada negocio tiene su moneda (businesses.currency); la suscripción de Pulso se cobra siempre en USD.
 * La app fija la moneda del negocio con setCurrency() al cargar; sin eso, USD.
 */
export const CURRENCY = "USD";

/** Monedas que ofrecemos al crear el negocio: código → [etiqueta, locale, decimales]. */
export const CURRENCIES: Record<string, { label: string; locale: string; decimals: number }> = {
  USD: { label: "Dólares (US$)", locale: "en-US", decimals: 2 },
  ARS: { label: "Pesos argentinos ($)", locale: "es-AR", decimals: 2 },
  COP: { label: "Pesos colombianos ($)", locale: "es-CO", decimals: 0 },
  MXN: { label: "Pesos mexicanos ($)", locale: "es-MX", decimals: 2 },
  CLP: { label: "Pesos chilenos ($)", locale: "es-CL", decimals: 0 },
  PEN: { label: "Soles (S/)", locale: "es-PE", decimals: 2 },
  UYU: { label: "Pesos uruguayos ($)", locale: "es-UY", decimals: 2 },
  BRL: { label: "Reales (R$)", locale: "pt-BR", decimals: 2 },
  EUR: { label: "Euros (€)", locale: "es-ES", decimals: 2 },
};

let active = CURRENCY;
export function setCurrency(c: string | null | undefined) { active = c && CURRENCIES[c] ? c : CURRENCY; }

export function formatMoney(cents: number, currency: string = active): string {
  const n = Number(cents) || 0;
  const sign = n < 0 ? "−" : "";
  const c = CURRENCIES[currency] ?? CURRENCIES.USD;
  const abs = Math.abs(n) / 100;
  if (currency === "USD" || !CURRENCIES[currency]) {
    return `${sign}US$ ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs)}`;
  }
  const num = new Intl.NumberFormat(c.locale, { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals }).format(abs);
  const sym = currency === "PEN" ? "S/" : currency === "EUR" ? "€" : currency === "BRL" ? "R$" : "$";
  return `${sign}${sym} ${num}`;
}

/** Siempre dólares. */
export const formatUsd = (cents: number) => formatMoney(cents, "USD");

/**
 * Lo que cobra Pulso se puede pagar en USD, ARS, BRL o EUR. Los valores locales son FIJOS (no el cambio del día) y se revisan a mano:
 * centavos locales por cada centavo de USD. Hoy: US$ 15 = ARS 21.000 = R$ 79 = € 12.
 */
export const BILLING_RATES = { ARS: 1400, BRL: 7900 / 1500, EUR: 0.8 } as const;
export type BillingCurrency = "USD" | keyof typeof BILLING_RATES;
/** Moneda en que se cobra a un negocio: la suya si Pulso la acepta; si no, dólares. */
export const billingCurrency = (c: string | null | undefined): BillingCurrency => (c && c in BILLING_RATES ? (c as BillingCurrency) : "USD");
/** Precio de Pulso en centavos de la moneda de cobro, a partir del precio en centavos de USD. */
export const planPrice = (usdCents: number, c: BillingCurrency): number => (c === "USD" ? usdCents : Math.round(usdCents * BILLING_RATES[c]));
/** Precio de Pulso formateado en la moneda de cobro del negocio actual. */
export const formatPlan = (usdCents: number) => { const c = billingCurrency(active); return formatMoney(planPrice(usdCents, c), c); };

/** Con signo explícito, para el libro: "+ US$ 25.00" / "− US$ 12.00". */
export function formatSigned(cents: number, currency: string = CURRENCY): string {
  return `${cents < 0 ? "−" : "+"} ${formatMoney(Math.abs(cents), currency)}`;
}

/** "25", "25.5", "25,50" (unidades de la moneda, lo que escribe el usuario) → 2550 centavos. Vacío/inválido → 0. */
export function toCents(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === "") return 0;
  const n = typeof input === "number" ? input : Number(String(input).trim().replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** 2550 → "25.50" para precargar inputs. */
export function centsToInput(cents: number): string {
  return (Number(cents) / 100).toFixed(2);
}

/** Redondeo half-up para enteros no negativos: floor(x + 0.5). Igual que el SQL. */
export function roundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

