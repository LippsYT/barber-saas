"use client";
import { useEffect, useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import { sb } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { STATUS_ES, isPaid } from "@/lib/billing-ui";

type Sub = { status: string; current_period_end: string | null; trial_end: string | null; cancel_at_period_end: boolean };

export default function Suscripcion() {
  const { biz, role } = useApp();
  const [sub, setSub] = useState<Sub | null | undefined>(undefined);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const ok = typeof window !== "undefined" && new URLSearchParams(location.search).get("ok") === "1";

  useEffect(() => {
    sb().from("subscriptions").select("status,current_period_end,trial_end,cancel_at_period_end").eq("business_id", biz.id).maybeSingle().then(({ data }) => setSub((data as Sub | null) ?? null));
  }, [biz.id]);

  async function go(action: "checkout" | "portal") {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) { setErr(j.error || "No se pudo abrir el pago."); setBusy(false); return; }
      location.href = j.url;
    } catch { setErr("No se pudo abrir el pago."); setBusy(false); }
  }

  const status = sub?.status ?? "none";
  const paid = isPaid(status);
  const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) : "");
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
      </section>
      <section className="card space-y-3">
        {role !== "owner" ? <p className="text-sm text-ink/60">Solo el dueño del negocio puede administrar la suscripción.</p> : <>
          {!paid && <button className="btn w-full" disabled={busy || sub === undefined} onClick={() => go("checkout")}>{busy ? "Abriendo…" : "Suscribirme"}</button>}
          {sub && status !== "none" && <button className="btn2 w-full" disabled={busy} onClick={() => go("portal")}>Administrar plan, tarjeta y facturas</button>}
        </>}
        <p className="flex items-start gap-2 text-xs text-ink/55"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />El pago lo procesa Stripe. Pulso nunca ve ni guarda los datos de tu tarjeta.</p>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      </section>
    </main>
  );
}
