"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, X } from "lucide-react";
import { useSubscription } from "@/lib/useSubscription";
import { AddonSheet, ADDON_ICON } from "@/components/app/AddonSheet";
import { formatUsd } from "@/lib/money";
import { ADDONS, BASE_PRICE, PLAN_NAME, SOON, addonOf, addonsTotal, type AddonKey, type SoonAddon } from "@/lib/addons";

const PANEL = "min-h-[70vh] rounded-[2rem] bg-[#070B14] bg-[radial-gradient(120%_55%_at_100%_0%,rgba(47,91,255,.38),transparent_60%)] p-4 text-white";

export default function Complementos() {
  const s = useSubscription();
  const [open, setOpen] = useState<AddonKey | null>(null);
  const [charges, setCharges] = useState(false);
  const [soon, setSoon] = useState<SoonAddon | null>(null);
  const active = s.paid ? s.active : [];
  const available = ADDONS.filter((a) => !active.includes(a.key));

  async function toggle(key: AddonKey, enable: boolean) {
    const ok = await s.setAddon(key, enable);
    if (ok) setOpen(null);
  }

  return (
    <main className={PANEL}>
      <div className="flex items-center gap-2"><Link href="/app/suscripcion" aria-label="Volver" className="-ml-1 p-1"><ChevronLeft className="h-6 w-6" /></Link><h1 className="font-display text-2xl font-extrabold">Complementos</h1></div>
      <p className="mt-3 text-sm text-white/65">Se suman a tu plan y se cobran aparte.</p>
      {s.free && <p className="mt-3 rounded-2xl bg-[#D6FF4A]/15 p-3 text-sm font-semibold text-[#D6FF4A]">En tu prueba los tienes todos gratis. Elige los que quieres conservar al suscribirte.</p>}

      {active.length > 0 && <>
        <div className="mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-widest text-white/45">Activos · {active.length}</div>
        <div className="space-y-2">{active.map((k) => { const a = addonOf(k)!; const I = ADDON_ICON[k]; return (
          <div key={k} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><I className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><div className="truncate font-bold">{a.name}</div><div className="text-xs text-white/55">{formatUsd(a.price)} al mes</div></div>
            <button className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-extrabold text-emerald-300" onClick={() => setOpen(k)}><Check className="h-3.5 w-3.5" />Activo</button>
          </div>); })}</div>
      </>}

      <div className="mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-widest text-white/45">Disponibles · {available.length}</div>
      <div className="space-y-2">{available.map((a) => { const I = ADDON_ICON[a.key]; return (
        <div key={a.key} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#2F5BFF]/20 text-[#7FA0FF]"><I className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><div className="truncate font-bold">{a.name}</div><div className="text-xs text-white/55">{formatUsd(a.price)} al mes</div></div>
          <button className="shrink-0 rounded-full bg-[#2F5BFF]/20 px-3 py-1.5 text-xs font-extrabold text-[#9DB4FF]" onClick={() => setOpen(a.key)}>Ver detalles</button>
        </div>); })}</div>

      <div className="mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-widest text-white/45">Próximamente · {SOON.length}</div>
      <div className="space-y-2">{SOON.map((c) => { const I = ADDON_ICON[c.key]; return (
        <div key={c.key} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-white/60"><I className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><div className="truncate font-bold">{c.name}</div><div className="text-xs text-white/55">{formatUsd(c.price)} al mes</div></div>
          <button className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-extrabold text-white/70" onClick={() => setSoon(c)}>Ver detalles</button>
        </div>); })}</div>

      {soon && (() => { const I = ADDON_ICON[soon.key]; return (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => setSoon(null)} role="dialog" aria-modal="true" aria-label={soon.name}>
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-[2rem] bg-[#0E1424] p-5 pb-[calc(1.25rem+var(--sab))] text-white" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#2F5BFF]/20 text-[#7FA0FF]"><I className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1"><h2 className="font-display text-2xl font-extrabold leading-tight">{soon.name}</h2><p className="text-sm text-white/55">Complemento · {formatUsd(soon.price)} al mes</p></div>
              <button aria-label="Cerrar" className="p-1 text-white/50" onClick={() => setSoon(null)}><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-4 text-base text-white/85">{soon.description}</p>
            <div className="mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-widest text-white/45">Qué incluye</div>
            <ul className="space-y-2">{soon.features.map((f) => <li key={f} className="flex gap-2.5 text-base text-white/90"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />{f}</li>)}</ul>
            <button disabled className="mt-6 w-full rounded-full bg-white/10 py-4 text-base font-extrabold text-white/60">Disponible pronto</button>
            <p className="mt-3 text-center text-xs text-white/45">Todavía no se puede contratar. Te avisaremos cuando esté listo.</p>
          </div>
        </div>); })()}

      <div className="sticky bottom-24 mt-6 flex items-center justify-between rounded-2xl bg-[#121A2E] p-4 shadow-xl ring-1 ring-white/10">
        <div><div className="text-xs text-white/55">Complementos activos</div><div className="font-display text-xl font-extrabold">{formatUsd(addonsTotal(active))} al mes</div></div>
        <button className="text-sm font-extrabold text-[#9DB4FF]" onClick={() => setCharges(true)}>Ver cobros</button>
      </div>

      {open && <AddonSheet addon={open} active={active.includes(open)} free={s.free} paidPlan={s.paid} current={active} owner={s.owner} busy={s.busy !== null} error={s.err}
        onClose={() => { setOpen(null); s.setErr(""); }} onToggle={(enable) => toggle(open, enable)} />}

      {charges && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => setCharges(false)} role="dialog" aria-modal="true" aria-label="Cobros de complementos">
          <div className="w-full rounded-t-[2rem] bg-[#0E1424] p-5 pb-[calc(1.25rem+var(--sab))] text-white" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-extrabold">Cobros de complementos</h2><button aria-label="Cerrar" className="p-1 text-white/50" onClick={() => setCharges(false)}><X className="h-5 w-5" /></button></div>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex justify-between"><span>{PLAN_NAME}</span><span className="font-bold">{formatUsd(BASE_PRICE)} al mes</span></li>
              {active.map((k) => <li key={k} className="flex justify-between"><span>{addonOf(k)!.name}</span><span className="font-bold">{formatUsd(addonOf(k)!.price)} al mes</span></li>)}
            </ul>
            <div className="mt-4 flex justify-between border-t border-white/10 pt-3 text-base font-extrabold"><span>Total al mes</span><span>{formatUsd(BASE_PRICE + addonsTotal(active))}</span></div>
            {!s.paid && <p className="mt-2 text-xs text-white/50">Todavía no pagas nada: estás en tu prueba. Al suscribirte pagarás el plan más los complementos que elijas.</p>}
          </div>
        </div>
      )}
    </main>
  );
}
