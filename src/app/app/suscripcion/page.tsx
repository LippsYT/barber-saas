"use client";
import { useEffect, useState } from "react";
import { Check, CreditCard, FileText, MessageCircle, Package, Repeat, ShieldCheck, type LucideIcon } from "lucide-react";
import { sb } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { STATUS_ES, isPaid } from "@/lib/billing-ui";
import { formatMoney } from "@/lib/money";
import { ADDONS, BASE_FEATURES, BASE_PRICE, addonOf, monthlyTotal, type AddonKey } from "@/lib/addons";

type Sub = { status: string; current_period_end: string | null; trial_end: string | null; cancel_at_period_end: boolean };
type Bill = { all?: boolean; addons?: string[] };
const ICON: Record<AddonKey, LucideIcon> = { whatsapp: MessageCircle, marketing: Repeat, informes: FileText, inventario: Package };

export default function Suscripcion() {
  const { biz, role } = useApp();
  const [sub, setSub] = useState<Sub | null | undefined>(undefined);
  const [bill, setBill] = useState<Bill | null>(null);
  const [picked, setPicked] = useState<AddonKey[]>([]);
  const [open, setOpen] = useState<AddonKey | null>(null);
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState("");
  const ok = typeof window !== "undefined" && new URLSearchParams(location.search).get("ok") === "1";

  const load = async () => {
    const [{ data: s }, { data: b }] = await Promise.all([
      sb().from("subscriptions").select("status,current_period_end,trial_end,cancel_at_period_end").eq("business_id", biz.id).maybeSingle(),
      sb().rpc("my_billing"),
    ]);
    setSub((s as Sub | null) ?? null); setBill((b as Bill | null) ?? null);
  };
  useEffect(() => { load(); }, [biz.id]);

  async function call(body: Record<string, unknown>, tag: string) {
    setBusy(tag); setErr("");
    try {
      const r = await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || "No se pudo completar. Intenta de nuevo."); setBusy(null); return null; }
      return j as { url?: string; addons?: string[] };
    } catch { setErr("No se pudo completar. Intenta de nuevo."); setBusy(null); return null; }
  }
  async function go(action: "checkout" | "portal") {
    const j = await call({ action, addons: picked }, action);
    if (j?.url) location.href = j.url; else setBusy(null);
  }
  async function toggle(key: AddonKey, enable: boolean) {
    const j = await call({ action: "addon", key, enable }, key);
    if (j) { await load(); setBusy(null); }
  }

  const status = sub?.status ?? "none";
  const paid = isPaid(status);
  const owner = role === "owner";
  const mine = bill?.addons ?? [];
  const inTrial = !paid && bill?.all === true;
  const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) : "");
  const monthly = monthlyTotal(paid ? mine : picked);
  const choose = (k: AddonKey) => setPicked((p) => {
    if (p.includes(k)) return p.filter((x) => x !== k && addonOf(x)?.needs !== k);
    const n = addonOf(k)?.needs;
    return [...p, k, ...(n && !p.includes(n) ? [n] : [])];
  });

  return (
    <main className="min-w-0 space-y-4">
      <div><div className="eyebrow mb-1">Tu plan de Pulso</div><h1 className="h1 !mb-0">Suscripción</h1></div>
      {ok && <p role="status" className="rounded-2xl bg-[#D6FF4A]/60 p-3 text-sm font-semibold">Gracias. Estamos confirmando tu pago; en unos segundos verás el plan activo.</p>}
      <section className="rounded-[1.7rem] bg-ink p-5 text-white">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#D6FF4A] text-ink"><CreditCard className="h-6 w-6" /></div>
        <div className="mt-3 text-[11px] font-extrabold uppercase tracking-widest text-[#D6FF4A]">Estado</div>
        <div className="font-display text-5xl font-extrabold leading-none">{sub === undefined ? "…" : STATUS_ES[status] ?? status}</div>
        {sub && paid && sub.current_period_end && <p className="mt-2 text-sm text-white/70">{sub.cancel_at_period_end ? "Termina el" : status === "trialing" ? "La prueba termina y se cobra el" : "Próximo cobro:"} {date(sub.current_period_end)}.</p>}
        {sub && status === "past_due" && <p className="mt-2 text-sm text-white/70">No pudimos cobrar tu tarjeta. Actualiza el método de pago.</p>}
        {inTrial && <p className="mt-2 text-sm text-white/70">En tu prueba tienes todos los complementos. Elige abajo los que quieres conservar al suscribirte.</p>}
      </section>

      <section className="card space-y-2">
        <div className="flex items-baseline justify-between"><h2 className="font-display text-xl font-extrabold uppercase">Plan base</h2><span className="font-display text-xl font-extrabold">{formatMoney(BASE_PRICE)}<span className="text-xs font-bold text-ink/50"> /mes</span></span></div>
        <ul className="space-y-1.5 text-sm">{BASE_FEATURES.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#14944A]" />{f}</li>)}</ul>
      </section>

      <section className="space-y-2">
        <div><h2 className="font-display text-xl font-extrabold uppercase">Complementos</h2><p className="text-xs text-ink/55">Súmalos al plan base cuando los necesites. Puedes quitarlos cuando quieras.</p></div>
        {ADDONS.map((a) => {
          const I = ICON[a.key];
          const active = paid ? mine.includes(a.key) : picked.includes(a.key);
          const lacksNeed = a.needs && !(paid ? mine : picked).includes(a.needs);
          return (
            <div key={a.key} className={`rounded-3xl bg-white p-4 shadow-soft ${active ? "ring-2 ring-[#2F5BFF]" : ""}`}>
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2F5BFF]/10 text-[#2F5BFF]"><I className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2"><span className="font-extrabold">{a.name}</span><span className="shrink-0 font-display text-lg font-extrabold">{formatMoney(a.price)}<span className="text-[10px] font-bold text-ink/50"> /mes</span></span></div>
                  <p className="text-sm text-ink/60">{a.summary}</p>
                  <button className="mt-1 text-xs font-bold text-[#2F5BFF]" onClick={() => setOpen(open === a.key ? null : a.key)}>{open === a.key ? "Ocultar detalle" : "Ver qué incluye"}</button>
                  {open === a.key && <ul className="mt-2 space-y-1 text-sm">{a.features.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#14944A]" />{f}</li>)}</ul>}
                </div>
              </div>
              {owner && (
                <div className="mt-3">
                  {paid
                    ? <button className={active ? "btn2 w-full" : "btn w-full"} disabled={busy !== null} onClick={() => toggle(a.key, !active)}>{busy === a.key ? "Un momento…" : active ? "Quitar complemento" : `Agregar · ${formatMoney(a.price)} al mes`}</button>
                    : <button className={active ? "btn2 w-full" : "btn w-full"} onClick={() => choose(a.key)}>{active ? "Incluido ✓ (tocar para quitar)" : `Incluir · ${formatMoney(a.price)} al mes`}</button>}
                  {a.needs && !active && lacksNeed && <p className="mt-1 text-xs text-ink/50">Incluye también {addonOf(a.needs)?.name}.</p>}
                  {paid && !active && <p className="mt-1 text-xs text-ink/50">Se suma a tu próxima factura, en proporción a los días que quedan del mes.</p>}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="card space-y-3">
        <div className="flex items-baseline justify-between"><span className="font-bold">Total al mes</span><span className="font-display text-3xl font-extrabold">{formatMoney(monthly)}</span></div>
        {!owner ? <p className="text-sm text-ink/60">Solo el dueño del negocio puede administrar la suscripción.</p> : <>
          {!paid && <button className="btn w-full" disabled={busy !== null || sub === undefined} onClick={() => go("checkout")}>{busy === "checkout" ? "Abriendo…" : `Suscribirme · ${formatMoney(monthly)} al mes`}</button>}
          {sub && status !== "none" && <button className="btn2 w-full" disabled={busy !== null} onClick={() => go("portal")}>Administrar tarjeta y facturas</button>}
        </>}
        <p className="flex items-start gap-2 text-xs text-ink/55"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />El pago lo procesa Stripe. Pulso nunca ve ni guarda los datos de tu tarjeta.</p>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      </section>
    </main>
  );
}
