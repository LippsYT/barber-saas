export type PayMethod = "cash" | "card" | "transfer" | "other";

export interface SaleLineIn { qty: number; unit_price: number }

export function saleTotals(lines: SaleLineIn[], discount: number, tip: number) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const d = Math.min(Math.max(discount, 0), subtotal);
  return { subtotal, discount: d, tip, total: subtotal - d + tip };
}

export interface PaymentIn { method: PayMethod; amount: number }
export interface PaymentPortion { method: PayMethod; kind: "income" | "tip"; amount: number }

/** Los pagos, en orden, cubren primero el ingreso (servicios/productos) y el resto es propina. */
export function splitPayments(payments: PaymentIn[], income: number, tip: number): PaymentPortion[] {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  if (paid !== income + tip) throw new Error(`Los pagos (${paid}) no suman el total (${income + tip})`);
  let incomeLeft = income;
  const out: PaymentPortion[] = [];
  for (const p of payments) {
    const toIncome = Math.min(p.amount, incomeLeft);
    incomeLeft -= toIncome;
    if (toIncome > 0) out.push({ method: p.method, kind: "income", amount: toIncome });
    if (p.amount - toIncome > 0) out.push({ method: p.method, kind: "tip", amount: p.amount - toIncome });
  }
  return out;
}

export const accountOf = (m: PayMethod) => (m === "cash" ? "cash" : m === "card" ? "card_clearing" : "bank");
