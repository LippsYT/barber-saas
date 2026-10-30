import { formatMoney } from "./money";

export type PayMethod = "cash" | "transfer" | "card" | "other";

export interface PricedService {
  name: string;
  /** Precio de esa cita, en centavos. Dos precios del mismo nombre no se mezclan. */
  unitPrice: number;
  qty?: number;
}

export interface ServiceBreakdownLine {
  name: string;
  unitPrice: number;
  qty: number;
  total: number;
}

/** Agrupa servicios cobrados: «10 × Corte US$ 12.00 · 5 × Corte niño US$ 8.00». */
export function serviceBreakdown(items: PricedService[]): { lines: ServiceBreakdownLine[]; total: number; sentence: string } {
  const map = new Map<string, ServiceBreakdownLine>();
  for (const item of items) {
    const qty = item.qty ?? 1;
    if (qty <= 0) continue;
    const key = `${item.name}\u0000${item.unitPrice}`;
    const prev = map.get(key);
    if (prev) prev.qty += qty;
    else map.set(key, { name: item.name, unitPrice: item.unitPrice, qty, total: 0 });
  }
  const lines = [...map.values()]
    .map((l) => ({ ...l, total: l.qty * l.unitPrice }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "es") || a.unitPrice - b.unitPrice);
  const total = lines.reduce((s, l) => s + l.total, 0);
  const sentence = lines.length
    ? lines.map((l) => `${l.qty} × ${l.name} ${formatMoney(l.unitPrice)}`).join(" · ")
    : "Todavía no hay servicios cobrados.";
  return { lines, total, sentence };
}

export type DrawerBucket = "sales" | "tips" | "expenses" | "advances" | "payouts" | "voids" | "other";

export interface DrawerMove {
  bucket: DrawerBucket;
  method: PayMethod;
  /** Centavos con signo: lo que entra es positivo, lo que sale es negativo. */
  amount: number;
}

const BUCKET_LABEL: Record<DrawerBucket, string> = {
  sales: "Servicios en efectivo",
  tips: "Propinas en efectivo",
  expenses: "Gastos en efectivo",
  advances: "Adelantos en efectivo",
  payouts: "Pagos al equipo en efectivo",
  voids: "Anulaciones en efectivo",
  other: "Otros movimientos en efectivo",
};
const BUCKET_ORDER: DrawerBucket[] = ["sales", "tips", "expenses", "advances", "payouts", "voids", "other"];

export interface DrawerClose {
  lines: { label: string; amount: number }[];
  expected: number;
  counted: number;
  difference: number;
  needsNote: boolean;
}

/** Efectivo que debería haber = solo lo que entró y salió en efectivo. Transferencia no cuenta. */
export function closeDrawer(moves: DrawerMove[], counted: number): DrawerClose {
  const cash = moves.filter((m) => m.method === "cash");
  const lines: { label: string; amount: number }[] = [];
  for (const bucket of BUCKET_ORDER) {
    const amount = cash.filter((m) => m.bucket === bucket).reduce((s, m) => s + m.amount, 0);
    if (amount !== 0) lines.push({ label: BUCKET_LABEL[bucket], amount });
  }
  const expected = lines.reduce((s, l) => s + l.amount, 0);
  const difference = counted - expected;
  return { lines, expected, counted, difference, needsNote: difference !== 0 };
}

export function differenceText(difference: number): string {
  if (difference === 0) return "Cuadra exacto.";
  if (difference < 0) return `Faltan ${formatMoney(-difference)} en el efectivo.`;
  return `Sobran ${formatMoney(difference)} en el efectivo.`;
}

export interface PeriodSale {
  id: string;
  barberId: string;
  barberName: string;
  /** Servicios cobrados, sin propina, en centavos. */
  income: number;
  tip: number;
  items: { name: string; unitPrice: number; qty: number; lineTotal: number }[];
  payments: { method: PayMethod; amount: number }[];
}

export interface PeriodExpense {
  amount: number;
  method: PayMethod;
  concept: string;
}

export interface MethodSplit { in: number; out: number; net: number }

export interface PeriodReport {
  serviceIncome: number;
  tips: number;
  income: number;
  expenses: number;
  net: number;
  byMethod: Record<PayMethod, MethodSplit>;
  byService: ServiceBreakdownLine[];
  byBarber: { id: string; name: string; services: number; income: number; tips: number }[];
}

const METHODS: PayMethod[] = ["cash", "transfer", "card", "other"];

/** Ingresos − gastos. La propina entra en los ingresos. El neto no resta comisiones: eso se ve en la liquidación. */
export function periodReport(sales: PeriodSale[], expenses: PeriodExpense[]): PeriodReport {
  const serviceIncome = sales.reduce((s, x) => s + x.income, 0);
  const tips = sales.reduce((s, x) => s + x.tip, 0);
  const income = serviceIncome + tips;
  const expenseTotal = expenses.reduce((s, x) => s + x.amount, 0);
  const byMethod = Object.fromEntries(METHODS.map((m) => [m, { in: 0, out: 0, net: 0 }])) as Record<PayMethod, MethodSplit>;
  for (const sale of sales) for (const p of sale.payments) {
    const row = byMethod[p.method] ?? byMethod.other;
    row.in += p.amount;
  }
  for (const e of expenses) {
    const row = byMethod[e.method] ?? byMethod.other;
    row.out += e.amount;
  }
  for (const m of METHODS) byMethod[m].net = byMethod[m].in - byMethod[m].out;
  const byService = serviceBreakdown(sales.flatMap((s) => s.items.map((i) => ({ name: i.name, unitPrice: i.unitPrice, qty: i.qty })))).lines;
  const barbers = new Map<string, { id: string; name: string; services: number; income: number; tips: number }>();
  for (const sale of sales) {
    const row = barbers.get(sale.barberId) ?? { id: sale.barberId, name: sale.barberName, services: 0, income: 0, tips: 0 };
    row.services += sale.items.reduce((s, i) => s + i.qty, 0);
    row.income += sale.income;
    row.tips += sale.tip;
    barbers.set(sale.barberId, row);
  }
  return {
    serviceIncome, tips, income, expenses: expenseTotal, net: income - expenseTotal, byMethod, byService,
    byBarber: [...barbers.values()].sort((a, b) => b.income - a.income || a.name.localeCompare(b.name, "es")),
  };
}

export interface SettleLine { label: string; amount: number; op: "+" | "−" | "=" | "→" }

export interface SettleInput {
  commissions: { id: string; description: string; amount: number }[];
  /** Adelantos todavía sin liquidar, del más viejo al más nuevo. */
  advances: { id: string; note: string; amount: number }[];
  /** Lo que sobró de adelantos en una liquidación anterior. */
  carriedIn: number;
  fixed?: number;
  fixedNote?: string;
}

export interface SettleResult {
  commissionTotal: number;
  fixedAmount: number;
  advancesTotal: number;
  carriedIn: number;
  /** Lo que hay que entregar ahora. Nunca negativo. */
  toPay: number;
  /** Adelanto que no se cubrió con lo ganado y pasa a la siguiente liquidación. */
  carryOut: number;
  lines: SettleLine[];
}

/**
 * A pagar = comisiones (+ sueldo, si tiene) − adelantos − lo que ya venía arrastrado.
 * Si los adelantos ganan, hoy se paga 0 y la diferencia queda para la próxima.
 */
export function settleAccounts(input: SettleInput): SettleResult {
  const commissionTotal = input.commissions.reduce((s, c) => s + c.amount, 0);
  const fixedAmount = input.fixed ?? 0;
  const advancesTotal = input.advances.reduce((s, a) => s + a.amount, 0);
  const carriedIn = Math.max(0, input.carriedIn);
  const algebraic = commissionTotal + fixedAmount - advancesTotal - carriedIn;
  const toPay = Math.max(0, algebraic);
  const carryOut = Math.max(0, -algebraic);
  const lines: SettleLine[] = [];
  if (input.commissions.length) lines.push({ label: input.commissions.length === 1 ? input.commissions[0].description : `Comisiones (${input.commissions.length})`, amount: Math.abs(commissionTotal), op: commissionTotal >= 0 ? "+" : "−" });
  else lines.push({ label: "Comisiones", amount: 0, op: "+" });
  if (fixedAmount) lines.push({ label: `Sueldo (${input.fixedNote ?? "del período"})`, amount: fixedAmount, op: "+" });
  for (const a of input.advances) lines.push({ label: a.note || "Adelanto", amount: a.amount, op: "−" });
  if (carriedIn) lines.push({ label: "Adelanto que venía de antes", amount: carriedIn, op: "−" });
  lines.push({ label: "A pagar", amount: toPay, op: "=" });
  if (carryOut) lines.push({ label: "Queda adelanto para la próxima", amount: carryOut, op: "→" });
  return { commissionTotal, fixedAmount, advancesTotal, carriedIn, toPay, carryOut, lines };
}

export function shareOf(amount: number, total: number): number {
  if (total <= 0 || amount <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((amount / total) * 100)));
}

export const METHOD_ES: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
};
