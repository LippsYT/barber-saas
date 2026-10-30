import type { CommissionRule } from "./commission";

export type CommissionKind = "percent" | "fixed";

/** Borrador de la pestaña Colaboradores: un barbero, si hace el servicio, y su comisión. */
export interface BarberCommissionDraft {
  memberId: string;
  selected: boolean;
  kind: CommissionKind;
  /** percent: 0–100. fixed: centavos USD por unidad. */
  value: number;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function clampFixedCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

/** Regla miembro+servicio. Gana sobre la regla del negocio (especificidad 4). */
export function draftsToRules(serviceId: string, drafts: BarberCommissionDraft[]): CommissionRule[] {
  return drafts.filter((d) => d.selected).map((d) => ({
    id: `${serviceId}:${d.memberId}`,
    member_id: d.memberId,
    item_type: "service",
    item_id: serviceId,
    kind: d.kind,
    value: d.kind === "percent" ? clampPercent(d.value) : clampFixedCents(d.value),
    base: "net_of_discount",
  }));
}

/** Filas para `commission_rules` (sin id: lo genera la base). */
export function draftsToDbRows(businessId: string, serviceId: string, drafts: BarberCommissionDraft[]) {
  return draftsToRules(serviceId, drafts).map(({ id: _id, ...rule }) => ({
    business_id: businessId,
    ...rule,
  }));
}

export function commissionLabel(kind: CommissionKind, value: number): string {
  if (kind === "percent") return `${clampPercent(value)} %`;
  const cents = clampFixedCents(value);
  const sign = cents < 0 ? "−" : "";
  const s = (Math.abs(cents) / 100).toFixed(2);
  return `${sign}US$ ${s} por servicio`;
}
