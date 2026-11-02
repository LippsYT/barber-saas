"use client";
import { Check, FileText, MessageCircle, Package, PencilLine, BarChart3, Receipt, Sparkles, Star, TrendingUp, X, type LucideIcon } from "lucide-react";
import { formatUsd } from "@/lib/money";
import { BASE_PRICE, addonOf, addonsTotal, type AddonKey } from "@/lib/addons";

export const ADDON_ICON: Record<string, LucideIcon> = { whatsapp: MessageCircle, resenas: Star, marketing: TrendingUp, informes: FileText, inventario: Package, campos: PencilLine, pixeles: BarChart3, facturacion: Receipt, asistente: Sparkles };

/** Ficha de un complemento (hoja desde abajo): qué incluye, cuánto pasarías a pagar y el botón para activarlo o quitarlo. */
export function AddonSheet({ addon, active, free, paidPlan, current, owner, busy, error, onClose, onToggle }: {
  addon: AddonKey; active: boolean; free: boolean; paidPlan: boolean; current: AddonKey[]; owner: boolean; busy: boolean; error: string;
  onClose: () => void; onToggle: (enable: boolean) => void;
}) {
  const a = addonOf(addon)!;
  const I = ADDON_ICON[a.key];
  const lacks = a.needs && !current.includes(a.needs) ? addonOf(a.needs) : undefined;
  // Con plan de pago: lo que pagas hoy + este. Sin plan: el plan base + este (+ lo que necesita).
  const next = paidPlan ? [...current, a.key, ...(lacks ? [lacks.key] : [])] : [a.key, ...(lacks ? [lacks.key] : [])];
  const total = BASE_PRICE + addonsTotal(next);
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={onClose} role="dialog" aria-modal="true" aria-label={a.name}>
      <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-[2rem] bg-[#0E1424] p-5 pb-[calc(1.25rem+var(--sab))] text-white" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#2F5BFF]/20 text-[#7FA0FF]"><I className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1"><h2 className="font-display text-2xl font-extrabold leading-tight">{a.name}</h2><p className="text-sm text-white/55">Complemento · {formatUsd(a.price)} al mes</p></div>
          <button aria-label="Cerrar" className="p-1 text-white/50" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-white/80">{a.description}</p>
        <div className="mt-4 text-[11px] font-extrabold uppercase tracking-widest text-white/45">Qué incluye</div>
        <ul className="mt-2 space-y-2 text-sm">{a.features.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7FA0FF]" />{f}</li>)}</ul>
        {lacks && !active && <p className="mt-3 rounded-xl bg-white/5 p-3 text-xs text-white/70">Necesita {lacks.name}: se agrega junto ({formatUsd(lacks.price)} al mes).</p>}
        {owner && !active && (
          <div className="mt-4 rounded-2xl bg-white/5 p-3">
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-white/45">Pasarías a pagar</div>
            <div className="font-display text-2xl font-extrabold">{formatUsd(total)} al mes</div>
            <div className="mt-1 text-xs text-white/55">Plan: {formatUsd(BASE_PRICE)} · Complementos: {formatUsd(addonsTotal(next))}</div>
          </div>
        )}
        {owner ? (
          <button className={`mt-4 h-12 w-full rounded-2xl text-base font-extrabold ${active && !free ? "bg-white/10 text-white" : "bg-[#2F5BFF] text-white"}`} disabled={busy} onClick={() => onToggle(!(active && !free))}>
            {busy ? "Un momento…" : active && !free ? "Quitar complemento" : `Activar por ${formatUsd(a.price)} al mes`}
          </button>
        ) : <p className="mt-4 text-sm text-white/60">Solo el dueño puede cambiar los complementos.</p>}
        {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
        <p className="mt-3 text-center text-xs text-white/45">{free ? "Ahora lo tienes gratis durante tu prueba. " : ""}Puedes quitarlo cuando quieras. Verás el precio final antes de pagar; no se hace ningún cobro sin tu aprobación.</p>
      </div>
    </div>
  );
}
