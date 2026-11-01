"use client";
import { useCallback, useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { isPaid } from "@/lib/billing-ui";
import { addonsTotal, type AddonKey } from "@/lib/addons";

export type Sub = { status: string; current_period_end: string | null; trial_end: string | null; cancel_at_period_end: boolean };
type Bill = { all?: boolean; addons?: string[]; trial_ends_at?: string; exempt?: boolean };

/** Estado de la suscripción del negocio y las acciones del dueño (contratar, quitar, portal). Lo comparten las pantallas de suscripción y complementos. */
export function useSubscription() {
  const { biz, role } = useApp();
  const [sub, setSub] = useState<Sub | null | undefined>(undefined);
  const [bill, setBill] = useState<Bill | null>(null);
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [{ data: s }, { data: b }] = await Promise.all([
      sb().from("subscriptions").select("status,current_period_end,trial_end,cancel_at_period_end").eq("business_id", biz.id).maybeSingle(),
      sb().rpc("my_billing"),
    ]);
    setSub((s as Sub | null) ?? null); setBill((b as Bill | null) ?? null);
  }, [biz.id]);
  useEffect(() => { load(); }, [load]);

  async function call(body: Record<string, unknown>, tag: string) {
    setBusy(tag); setErr("");
    try {
      const r = await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || "No se pudo completar. Intenta de nuevo."); setBusy(null); return null; }
      return j as { url?: string; addons?: string[] };
    } catch { setErr("No se pudo completar. Intenta de nuevo."); setBusy(null); return null; }
  }
  /** Abre Stripe para suscribirse (con los complementos elegidos) o el portal de facturas y cancelación. */
  async function go(action: "checkout" | "portal", addons: AddonKey[] = []) {
    const j = await call({ action, addons }, action);
    if (j?.url) location.href = j.url; else setBusy(null);
  }
  /** Contrata o quita un complemento. Si aún no hay plan de pago, abre el pago del plan con ese complemento. */
  async function setAddon(key: AddonKey, enable: boolean) {
    if (!isPaid(sub?.status ?? "none")) { if (enable) await go("checkout", [key]); return false; }
    const j = await call({ action: "addon", key, enable }, key);
    if (!j) return false;
    await load(); setBusy(null); return true;
  }

  const status = sub?.status ?? "none";
  const paid = isPaid(status);
  const active = (bill?.addons ?? []) as AddonKey[];
  return {
    sub, status, paid, owner: role === "owner", busy, err, setErr, load, go, setAddon,
    /** Complementos que paga hoy (con plan de pago). */
    active,
    /** En prueba o exento: tiene todos sin pagarlos. */
    free: bill?.all === true && !paid,
    trialEnds: bill?.trial_ends_at ?? null,
    exempt: bill?.exempt === true,
    addonsMonthly: addonsTotal(active),
  };
}
