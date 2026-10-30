export type PayPeriod = "weekly" | "biweekly" | "monthly";
export type PayType = "commission" | "fixed" | "mixed";

export interface PayoutInput {
  pay_type: PayType;
  fixed_salary: number; // sueldo por período completo (pay_period)
  pay_period: PayPeriod;
  period_start: string; // YYYY-MM-DD inclusive
  period_end: string; // inclusive
  commissions: { id: string; description: string; amount: number }[];
  adjustments: { reason: string; amount: number }[]; // con signo
  advances: { reason: string; amount: number }[]; // positivos, se restan
}

export interface PayoutResult {
  commission_total: number;
  fixed_amount: number;
  fixed_note: string;
  adjustments_total: number;
  advances_total: number;
  total: number;
  lines: { label: string; amount: number; op: "+" | "−" | "="; running: number }[];
}

const DAY = 86400000;
const toUTC = (s: string) => Date.parse(s + "T00:00:00Z");
export const daysInclusive = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / DAY) + 1;
export function daysInMonthOf(date: string): number {
  const d = new Date(toUTC(date));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}
const periodDays = (p: PayPeriod, start: string) => (p === "weekly" ? 7 : p === "biweekly" ? 14 : daysInMonthOf(start));

/** Sueldo fijo prorrateado = sueldo × días del rango / días del período (half-up). Máx. 1 período completo. */
export function proratedFixed(salary: number, period: PayPeriod, start: string, end: string): { amount: number; note: string } {
  const days = daysInclusive(start, end);
  const pd = periodDays(period, start);
  const used = Math.min(days, pd);
  const amount = Math.floor((2 * salary * used + pd) / (2 * pd));
  return { amount, note: used === pd ? "período completo" : `${used}/${pd} días` };
}

export function computePayout(i: PayoutInput): PayoutResult {
  const commission_total = i.pay_type === "fixed" ? 0 : i.commissions.reduce((s, c) => s + c.amount, 0);
  const fx = i.pay_type === "commission" ? { amount: 0, note: "sin sueldo fijo" } : proratedFixed(i.fixed_salary, i.pay_period, i.period_start, i.period_end);
  const adjustments_total = i.adjustments.reduce((s, a) => s + a.amount, 0);
  const advances_total = i.advances.reduce((s, a) => s + a.amount, 0);
  const total = commission_total + fx.amount + adjustments_total - advances_total;
  const lines: PayoutResult["lines"] = [];
  let running = 0;
  const push = (label: string, amount: number, op: "+" | "−") => {
    running += op === "+" ? amount : -amount;
    lines.push({ label, amount, op, running });
  };
  if (i.pay_type !== "fixed") push(`Σ comisiones (${i.commissions.length} líneas)`, commission_total, "+");
  if (i.pay_type !== "commission") push(`Sueldo fijo prorrateado (${fx.note})`, fx.amount, "+");
  for (const a of i.adjustments) a.amount >= 0 ? push(`Ajuste: ${a.reason}`, a.amount, "+") : push(`Ajuste: ${a.reason}`, -a.amount, "−");
  for (const a of i.advances) push(`Adelanto: ${a.reason}`, a.amount, "−");
  lines.push({ label: "Total a pagar", amount: total, op: "=", running: total });
  return { commission_total, fixed_amount: fx.amount, fixed_note: fx.note, adjustments_total, advances_total, total, lines };
}
