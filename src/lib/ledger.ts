export type LedgerType =
  | "sale_income" | "tip_income" | "refund" | "void_reversal" | "expense" | "commission_accrual"
  | "salary_accrual" | "payout" | "cash_in" | "cash_out" | "opening_float" | "adjustment";
export type LedgerAccount = "cash" | "bank" | "card_clearing" | "payable_staff";

export interface LedgerEntry {
  id: string;
  occurred_at: string;
  type: LedgerType;
  direction: 1 | -1;
  amount: number; // > 0
  method?: string | null;
  account: LedgerAccount;
  member_id?: string | null;
  description: string;
  reversal_of?: string | null;
  source_table?: string | null;
  source_id?: string | null;
}

/** Cuentas que representan dinero del negocio. payable_staff es memo (lo que se debe al personal). */
export const MONEY_ACCOUNTS: LedgerAccount[] = ["cash", "bank", "card_clearing"];

export const signed = (e: Pick<LedgerEntry, "direction" | "amount">) => e.direction * e.amount;

export function balance(entries: Pick<LedgerEntry, "direction" | "amount" | "account">[], accounts?: LedgerAccount[]): number {
  return entries.reduce((s, e) => (!accounts || accounts.includes(e.account) ? s + signed(e) : s), 0);
}

export interface RunningLine<T> { entry: T; signed: number; running: number }

/** Orden cronológico (occurred_at, luego id) con acumulado. El último acumulado === balance(). */
export function withRunningSum<T extends LedgerEntry>(entries: T[]): RunningLine<T>[] {
  const sorted = [...entries].sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : a.id < b.id ? -1 : 1));
  let running = 0;
  return sorted.map((entry) => {
    const s = signed(entry);
    running += s;
    return { entry, signed: s, running };
  });
}

/** Verifica que cada reversal_of apunte a un asiento existente, con monto igual y dirección opuesta. */
export function validateReversals(entries: LedgerEntry[]): string[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const errs: string[] = [];
  for (const e of entries) {
    if (!e.reversal_of) continue;
    const o = byId.get(e.reversal_of);
    if (!o) errs.push(`${e.id}: original ${e.reversal_of} no encontrado`);
    else if (o.amount !== e.amount || o.direction === e.direction) errs.push(`${e.id}: no es inverso exacto de ${o.id}`);
  }
  return errs;
}
