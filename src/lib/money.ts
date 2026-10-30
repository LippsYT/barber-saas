/** Montos siempre enteros (unidad mínima de la moneda; COP no usa centavos en la práctica). */
export function formatMoney(n: number, currency = "COP"): string {
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  const s = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(abs);
  return `${sign}$${s}${currency && currency !== "COP" ? " " + currency : ""}`;
}

/** Con signo explícito, para el libro: "+ $25.000" / "− $12.000". */
export function formatSigned(n: number, currency = "COP"): string {
  return `${n < 0 ? "−" : "+"} ${formatMoney(Math.abs(n), currency)}`;
}

/** Redondeo half-up para enteros no negativos: floor(x + 0.5). Igual que el SQL. */
export function roundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}
