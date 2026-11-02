"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, CreditCard, Minus, X } from "lucide-react";
import { sb } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { useSubscription } from "@/lib/useSubscription";
import { STATUS_ES } from "@/lib/billing-ui";
import { formatUsd } from "@/lib/money";
import { ADDONS, BASE_FEATURES, BASE_PRICE, PLAN_NAME, monthlyTotal } from "@/lib/addons";

const PANEL = "min-h-[70vh] space-y-3 rounded-[2rem] bg-[#070B14] bg-[radial-gradient(120%_55%_at_100%_0%,rgba(47,91,255,.38),transparent_60%)] p-4 text-white";
const CARD = "rounded-3xl bg-white/[0.06] p-4 ring-1 ring-white/10";
const date = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) : "");

export default function Suscripcion() {
  const { biz } = useApp();
  const s = useSubscription();
  const [counts, setCounts] = useState<{ clients: number; visits: number } | null>(null);
  const [compare, setCompare] = useState(false);
  const ok = typeof window !== "undefined" && new URLSearchParams(location.search).get("ok") === "1";

  useEffect(() => {
    Promise.all([
      sb().from("clients").select("id", { count: "exact", head: true }).eq("business_id", biz.id),
      sb().from("appointments").select("id", { count: "exact", head: true }).eq("business_id", biz.id).eq("status", "completed"),
    ]).then(([c, a]) => setCounts({ clients: c.count ?? 0, visits: a.count ?? 0 }));
  }, [biz.id]);

  const nActive = s.paid ? s.active.length : 0;
  const renew = date(s.sub?.current_period_end);
  const sub = s.exempt ? "Cuenta sin cobro" : s.paid ? `Mensual · ${s.sub?.cancel_at_period_end ? "termina" : "renueva"} el ${renew}` : s.trialEnds ? `Prueba gratis · termina el ${date(s.trialEnds)}` : "Sin suscripción";

  return (
    <main className={PANEL}>
      <div className="flex items-center gap-2"><Link href="/app/ajustes" aria-label="Volver a Ajustes" className="-ml-1 p-1"><ChevronLeft className="h-6 w-6" /></Link><h1 className="font-display text-2xl font-extrabold">Suscripción</h1></div>
      {ok && <p role="status" className="rounded-2xl bg-[#D6FF4A]/20 p-3 text-sm font-semibold text-[#D6FF4A]">Gracias. Estamos confirmando tu pago; en unos segundos verás el plan activo.</p>}

      <section className={CARD}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2F5BFF]/25 text-[#9DB4FF]"><CreditCard className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1"><div className="truncate font-extrabold">{PLAN_NAME}</div><div className="text-xs text-white/55">{sub}</div></div>
          <div className="shrink-0 text-right"><div className="font-display text-lg font-extrabold">{formatUsd(BASE_PRICE)}</div><div className="text-[10px] text-white/55">al mes</div></div>
        </div>
        {s.sub && s.status !== "none" && <span className="mt-3 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold">{STATUS_ES[s.status] ?? s.status}</span>}
        {s.status === "past_due" && <p className="mt-2 text-xs text-white/70">No pudimos cobrar tu tarjeta. Actualiza el método de pago.</p>}
        <ul className="mt-4 space-y-2 border-t border-white/10 pt-3 text-sm">{BASE_FEATURES.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7FA0FF]" />{f}</li>)}</ul>

        <Link href="/app/suscripcion/complementos" className="mt-3 flex items-center justify-between border-t border-white/10 py-3">
          <span><span className="block font-bold">Complementos</span><span className="block text-xs text-white/55">{nActive} {nActive === 1 ? "activo" : "activos"} · {ADDONS.length - nActive} disponibles</span></span>
          <ChevronRight className="h-5 w-5 text-white/50" />
        </Link>
        <button className="flex w-full items-center justify-between border-t border-white/10 py-3 text-left" onClick={() => setCompare(true)}>
          <span className="font-bold">Comparar planes</span><ChevronRight className="h-5 w-5 text-white/50" />
        </button>

        {s.owner && !s.paid && !s.exempt && (
          <div className="mt-2 rounded-2xl bg-white/5 p-3">
            <div className="font-bold">Activa tu plan</div>
            <p className="mt-1 text-xs text-white/60">Tu prueba incluye todo. Suscríbete antes de que termine para seguir sin interrupciones.</p>
            <button className="mt-3 h-12 w-full rounded-2xl bg-[#2F5BFF] text-base font-extrabold" disabled={s.busy !== null || s.sub === undefined} onClick={() => s.go("checkout")}>{s.busy === "checkout" ? "Abriendo…" : `Suscribirme · ${formatUsd(BASE_PRICE)} al mes`}</button>
            <p className="mt-2 text-center text-[11px] text-white/45">Verás el precio final y las condiciones antes de confirmar. No se hará ningún cobro sin tu aprobación.</p>
          </div>
        )}
        {!s.owner && <p className="mt-2 text-xs text-white/55">Solo el dueño del negocio puede cambiar el plan.</p>}
        {s.err && <p role="alert" className="mt-2 text-sm text-red-300">{s.err}</p>}
      </section>

      <section className={CARD}>
        <div className="text-[11px] font-extrabold uppercase tracking-widest text-white/45">Con Pulso llevas</div>
        <div className="mt-2 font-display text-3xl font-extrabold">{counts?.clients ?? "…"}</div><div className="text-sm text-white/60">Clientes registrados</div>
        <div className="mt-3 font-display text-3xl font-extrabold">{counts?.visits ?? "…"}</div><div className="text-sm text-white/60">Citas atendidas</div>
      </section>

      {s.owner && s.sub && s.status !== "none" && (
        <div className="flex flex-col items-center gap-3 pt-2 text-sm">
          <button className="font-bold text-[#9DB4FF]" disabled={s.busy !== null} onClick={() => s.go("portal")}>Administrar tarjeta y facturas</button>
          {s.paid && !s.sub.cancel_at_period_end && <button className="text-white/45 underline" disabled={s.busy !== null} onClick={() => s.go("portal")}>Cancelar suscripción</button>}
          {s.sub.cancel_at_period_end && <p className="text-center text-xs text-white/55">Tu suscripción termina el {renew}. Puedes reactivarla desde Administrar tarjeta y facturas.</p>}
        </div>
      )}
      <p className="pt-1 text-center text-[11px] text-white/40">El pago lo procesa Stripe. Pulso nunca ve ni guarda los datos de tu tarjeta.</p>

      {compare && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => setCompare(false)} role="dialog" aria-modal="true" aria-label="Comparar planes">
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-[2rem] bg-[#0E1424] p-5 pb-[calc(1.25rem+var(--sab))] text-white" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-extrabold">Comparar planes</h2><button aria-label="Cerrar" className="p-1 text-white/50" onClick={() => setCompare(false)}><X className="h-5 w-5" /></button></div>
            <div className="mt-4 grid grid-cols-[1fr_4.5rem_4.5rem] items-end gap-x-2 text-center text-xs">
              <span />
              <span><b className="block text-sm">Plan</b>{formatUsd(BASE_PRICE)}</span>
              <span><b className="block text-sm">Completo</b>{formatUsd(monthlyTotal(ADDONS.map((a) => a.key)))}</span>
            </div>
            <ul className="mt-2 divide-y divide-white/10 text-sm">
              {BASE_FEATURES.map((f) => <li key={f} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-x-2 py-2.5"><span>{f}</span><Check className="mx-auto h-4 w-4 text-[#7FA0FF]" /><Check className="mx-auto h-4 w-4 text-[#7FA0FF]" /></li>)}
              {ADDONS.map((a) => <li key={a.key} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-x-2 py-2.5"><span>{a.name}<span className="block text-xs text-white/45">+{formatUsd(a.price)} al mes</span></span><Minus className="mx-auto h-4 w-4 text-white/30" /><Check className="mx-auto h-4 w-4 text-[#7FA0FF]" /></li>)}
            </ul>
            <Link href="/app/suscripcion/complementos" className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-[#2F5BFF] text-base font-extrabold">Elegir complementos</Link>
          </div>
        </div>
      )}
    </main>
  );
}
