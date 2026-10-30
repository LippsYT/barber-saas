import type { LedgerEntry, LedgerType } from "./ledger";
import { signed } from "./ledger";

export interface CashLine { label: string; amount: number; entryIds: string[] }

export interface CashExpected {
  opening_float: number;
  lines: CashLine[];
  expected: number;
}

const LABELS: Partial<Record<LedgerType, string>> = {
  sale_income: "Ventas en efectivo",
  tip_income: "Propinas en efectivo",
  expense: "Gastos pagados en efectivo",
  void_reversal: "Anulaciones / reversos en efectivo",
  refund: "Devoluciones en efectivo",
  payout: "Pagos a personal en efectivo",
  cash_out: "Retiros de efectivo",
  cash_in: "Ingresos de efectivo",
  adjustment: "Ajustes",
};
const ORDER: LedgerType[] = ["sale_income", "tip_income", "cash_in", "expense", "refund", "void_reversal", "payout", "cash_out", "adjustment"];

/** Efectivo esperado = fondo inicial + Σ(asientos de la cuenta cash de la sesión). */
export function expectedCash(opening_float: number, entries: LedgerEntry[]): CashExpected {
  const cash = entries.filter((e) => e.account === "cash");
  const lines: CashLine[] = [];
  for (const t of ORDER) {
    const of = cash.filter((e) => e.type === t);
    if (!of.length) continue;
    lines.push({ label: LABELS[t] ?? t, amount: of.reduce((s, e) => s + signed(e), 0), entryIds: of.map((e) => e.id) });
  }
  const expected = opening_float + lines.reduce((s, l) => s + l.amount, 0);
  return { opening_float, lines, expected };
}

export interface CashClose { expected: number; counted: number; difference: number; needsNote: boolean }

export function closeCash(expected: number, counted: number): CashClose {
  const difference = counted - expected;
  return { expected, counted, difference, needsNote: difference !== 0 };
}

/** Conteo por denominación: { "2000": 3, "100": 10 } (centavos) → total. */
export function denominationsTotal(counts: Record<string, number>): number {
  return Object.entries(counts).reduce((s, [d, n]) => s + Number(d) * Math.max(0, Math.floor(n)), 0);
}

/** Billetes y monedas USD en centavos. */
export const USD_DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 100, 25, 10, 5, 1];

/** Ventas por método de pago (informativo, no cuentan en efectivo esperado). */
export function otherMethodsTotals(entries: LedgerEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (e.account === "cash" || e.account === "payable_staff") continue;
    out[e.account] = (out[e.account] ?? 0) + signed(e);
  }
  return out;
}
