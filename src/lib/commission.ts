import { roundHalfUp } from "./money";

export type ItemType = "service" | "product" | "tip";

export interface CommissionRule {
  id: string;
  member_id: string | null;
  item_type: ItemType;
  item_id: string | null;
  kind: "percent" | "fixed";
  /** percent: 50 = 50 %; fixed: monto por unidad */
  value: number;
  base: "gross" | "net_of_discount";
  valid_from?: string | null; // YYYY-MM-DD inclusive
  valid_to?: string | null;
}

export interface CommissionLine {
  item_type: ItemType;
  item_id: string | null;
  member_id: string;
  description: string;
  qty: number;
  unit_price: number; // precio de lista unitario (propina: monto de la propina)
  discount: number; // descuento total de la línea
}

export interface RuleSnapshot {
  rule: Omit<CommissionRule, "valid_from" | "valid_to"> & { scope: Scope } | null;
  description: string;
  item_type: ItemType;
  qty: number;
  gross: number;
  discount: number;
  base_amount: number;
}

export type Scope = "member_item" | "member" | "item" | "business";

/** Especificidad: miembro+ítem > miembro > ítem > negocio. 0 = no aplica. */
export function specificity(rule: CommissionRule, line: Pick<CommissionLine, "item_type" | "item_id" | "member_id">): number {
  if (rule.item_type !== line.item_type) return 0;
  if (rule.member_id !== null && rule.member_id !== line.member_id) return 0;
  if (rule.item_id !== null && rule.item_id !== line.item_id) return 0;
  if (rule.member_id !== null && rule.item_id !== null) return 4;
  if (rule.member_id !== null) return 3;
  if (rule.item_id !== null) return 2;
  return 1;
}

export function scopeOf(score: number): Scope {
  return (["business", "business", "item", "member", "member_item"] as Scope[])[score] ?? "business";
}

function inRange(rule: CommissionRule, onDate: string): boolean {
  if (rule.valid_from && onDate < rule.valid_from) return false;
  if (rule.valid_to && onDate > rule.valid_to) return false;
  return true;
}

/** Regla ganadora. Empate de especificidad: vigencia más reciente (valid_from), luego id (determinista). */
export function pickRule(rules: CommissionRule[], line: Pick<CommissionLine, "item_type" | "item_id" | "member_id">, onDate: string): { rule: CommissionRule; score: number } | null {
  let best: { rule: CommissionRule; score: number } | null = null;
  for (const r of rules) {
    if (!inRange(r, onDate)) continue;
    const score = specificity(r, line);
    if (!score) continue;
    if (
      !best ||
      score > best.score ||
      (score === best.score && ((r.valid_from ?? "") > (best.rule.valid_from ?? "") || ((r.valid_from ?? "") === (best.rule.valid_from ?? "") && r.id > best.rule.id)))
    ) {
      best = { rule: r, score };
    }
  }
  return best;
}

export function computeLineCommission(line: CommissionLine, rules: CommissionRule[], onDate: string): { amount: number; snapshot: RuleSnapshot } {
  const gross = line.qty * line.unit_price;
  const discount = line.item_type === "tip" ? 0 : line.discount;
  const picked = pickRule(rules, line, onDate);
  if (!picked) {
    return { amount: 0, snapshot: { rule: null, description: line.description, item_type: line.item_type, qty: line.qty, gross, discount, base_amount: 0 } };
  }
  const { rule, score } = picked;
  const base_amount = rule.base === "gross" ? gross : gross - discount;
  const amount = rule.kind === "percent" ? roundHalfUp(base_amount * Math.round(rule.value * 1000), 100000) : Math.round(rule.value * line.qty);
  const { valid_from: _f, valid_to: _t, ...r } = rule;
  return { amount, snapshot: { rule: { ...r, scope: scopeOf(score) }, description: line.description, item_type: line.item_type, qty: line.qty, gross, discount, base_amount } };
}

/** Reparte el descuento de la venta entre líneas, proporcional al bruto. El resto va a la última línea con bruto > 0. */
export function allocateDiscount(grosses: number[], discount: number): number[] {
  const total = grosses.reduce((a, b) => a + b, 0);
  const d = Math.min(Math.max(discount, 0), total);
  if (total === 0 || d === 0) return grosses.map(() => 0);
  const out = grosses.map((g) => Math.floor((g * d) / total));
  let rest = d - out.reduce((a, b) => a + b, 0);
  for (let i = grosses.length - 1; i >= 0 && rest > 0; i--) {
    const room = grosses[i] - out[i];
    const add = Math.min(room, rest);
    out[i] += add;
    rest -= add;
  }
  return out;
}

export interface ExplainLine {
  label: string;
  /** monto con signo cuando aplica */
  amount?: number;
  text?: string;
  op?: "=" | "−" | "×" | "+";
}

const SCOPE_ES: Record<Scope, string> = {
  member_item: "Barbero + ítem",
  member: "Barbero",
  item: "Ítem",
  business: "Negocio",
};

/** Desglose línea a línea a partir del snapshot guardado (no depende de las reglas actuales). */
export function explainCommission(snap: RuleSnapshot, amount: number): ExplainLine[] {
  const out: ExplainLine[] = [];
  if (snap.item_type === "tip") {
    out.push({ label: `Propina`, amount: snap.gross });
  } else {
    out.push({ label: `${snap.description}${snap.qty > 1 ? ` × ${snap.qty}` : ""} · precio lista`, amount: snap.gross });
    out.push({ label: "Descuento", amount: snap.discount, op: "−" });
    out.push({ label: snap.rule?.base === "gross" ? "Base (sobre precio bruto)" : "Base (neto de descuento)", amount: snap.base_amount, op: "=" });
  }
  if (!snap.rule) {
    out.push({ label: "Sin regla de comisión aplicable", amount: 0, op: "=" });
    return out;
  }
  const r = snap.rule;
  out.push({ label: `Regla (${SCOPE_ES[r.scope]}) ${r.kind === "percent" ? "" : "monto fijo"}`, text: r.kind === "percent" ? `${r.value} %` : `${r.value} por unidad`, op: "×" });
  out.push({ label: amount < 0 ? "Comisión (reversada)" : "Comisión", amount, op: "=" });
  return out;
}
