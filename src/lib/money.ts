/**
 * Moneda única de la app: USD. Todos los montos se guardan como ENTEROS en centavos
 * (bigint en la DB): 2500 = US$ 25.00. Formato siempre "US$ 25.00".
 */
export const CURRENCY = "USD";

export function formatMoney(cents: number, _currency: string = CURRENCY): string {
  const n = Number(cents) || 0;
  const sign = n < 0 ? "−" : "";
  const s = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n) / 100);
  return `${sign}US$ ${s}`;
}

/** Con signo explícito, para el libro: "+ US$ 25.00" / "− US$ 12.00". */
export function formatSigned(cents: number, currency: string = CURRENCY): string {
  return `${cents < 0 ? "−" : "+"} ${formatMoney(Math.abs(cents), currency)}`;
}

/** "25", "25.5", "25,50" (dólares, lo que escribe el usuario) → 2550 centavos. Vacío/inválido → 0. */
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
