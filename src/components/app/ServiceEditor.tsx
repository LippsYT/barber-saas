"use client";
import { useMemo, useState } from "react";
import { centsToInput, formatMoney, toCents } from "@/lib/money";
import { clampFixedCents, clampPercent, commissionLabel, type BarberCommissionDraft, type CommissionKind } from "@/lib/serviceCommission";

const DURATIONS = [5, 10, 15, 20, 30, 35, 40, 45, 60, 70, 90, 120, 180, 300];

export interface ServiceDraft {
  name: string;
  price: string;
  duration: string;
  description: string;
  drafts: BarberCommissionDraft[];
}

export function emptyServiceDraft(members: { id: string; name: string }[]): ServiceDraft {
  return {
    name: "", price: "", duration: "45", description: "",
    drafts: members.map((m) => ({ memberId: m.id, selected: true, kind: "percent" as const, value: 50 })),
  };
}

export function ServiceEditor({
  members, currency = "USD", initial, submitLabel = "Crear", onSubmit, onCancel, busy, error, startTab = "info",
}: {
  members: { id: string; name: string }[];
  currency?: string;
  initial?: ServiceDraft;
  submitLabel?: string;
  onSubmit: (draft: ServiceDraft) => Promise<void> | void;
  onCancel?: () => void;
  busy?: boolean;
  error?: string;
  startTab?: "info" | "team";
}) {
  const [tab, setTab] = useState<"info" | "team">(startTab);
  const [draft, setDraft] = useState<ServiceDraft>(initial ?? emptyServiceDraft(members));
  const [extra, setExtra] = useState(false);
  const priceCents = toCents(draft.price);
  const allOn = draft.drafts.length > 0 && draft.drafts.every((d) => d.selected);

  const durations = useMemo(() => {
    const n = Number(draft.duration);
    return DURATIONS.includes(n) ? DURATIONS : [...DURATIONS, n].sort((a, b) => a - b);
  }, [draft.duration]);

  function patchDraft(memberId: string, patch: Partial<BarberCommissionDraft>) {
    setDraft({ ...draft, drafts: draft.drafts.map((d) => d.memberId === memberId ? { ...d, ...patch } : d) });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void onSubmit(draft); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-full bg-[#E7E3D8] p-1">
        <button type="button" className={`rounded-full py-2 text-sm font-extrabold ${tab === "info" ? "bg-ink text-white" : "text-ink/60"}`} onClick={() => setTab("info")}>Información</button>
        <button type="button" className={`rounded-full py-2 text-sm font-extrabold ${tab === "team" ? "bg-ink text-white" : "text-ink/60"}`} onClick={() => setTab("team")}>Colaboradores</button>
      </div>

      {tab === "info" && (
        <div className="space-y-3">
          <h2 className="font-display text-2xl font-extrabold uppercase">Información básica</h2>
          <label className="lbl">Nombre del servicio *
            <input className="inp mt-1" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="corte simple" />
          </label>
          <label className="lbl">Precio (US$) *
            <input className="inp mt-1" required inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="10.00" />
          </label>
          <label className="lbl">Tiempo del servicio *
            <select className="inp mt-1" value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })}>
              {durations.map((n) => <option key={n} value={n}>{n} minutos</option>)}
            </select>
          </label>
          <button type="button" className="flex w-full items-center justify-between py-2 text-left font-display text-lg font-extrabold uppercase" onClick={() => setExtra(!extra)}>
            Configuración adicional <span>{extra ? "▴" : "▾"}</span>
          </button>
          {extra && <label className="lbl">Descripción
            <textarea className="inp mt-1" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>}
        </div>
      )}

      {tab === "team" && (
        <div className="space-y-3">
          <h2 className="font-display text-2xl font-extrabold uppercase">Personalizar servicio</h2>
          <p className="text-sm text-ink/60">Elige qué profesionales lo hacen y cuánto ganan de comisión. Esta regla (barbero + servicio) gana sobre la regla general del negocio.</p>
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-[#2F5BFF]" checked={allOn} onChange={(e) => setDraft({ ...draft, drafts: draft.drafts.map((d) => ({ ...d, selected: e.target.checked })) })} />
            Seleccionar todos
          </label>
          {draft.drafts.length === 0 && <p className="text-sm text-ink/50">Agrega colaboradores primero. Sin ellos, el servicio queda creado y la comisión sigue la regla del negocio (50 %).</p>}
          {draft.drafts.map((d) => {
            const name = members.find((m) => m.id === d.memberId)?.name ?? "Barbero";
            const max = Math.max(priceCents, d.kind === "fixed" ? d.value : 0, 100);
            return (
              <div key={d.memberId} className="rounded-3xl border border-white/10 bg-ink p-4 text-white">
                <label className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-semibold"><input type="checkbox" className="h-5 w-5 accent-[#2F5BFF]" checked={d.selected} onChange={(e) => patchDraft(d.memberId, { selected: e.target.checked })} />{name}</span>
                  <span className="flex rounded-full bg-white/10 p-1 text-xs font-extrabold">
                    {(["percent", "fixed"] as CommissionKind[]).map((k) => (
                      <button type="button" key={k} className={`rounded-full px-3 py-1 ${d.kind === k ? "bg-white text-ink" : "text-white/70"}`} onClick={() => patchDraft(d.memberId, { kind: k, value: k === "percent" ? 30 : Math.round(priceCents * 0.3) })}>{k === "percent" ? "%" : "USD"}</button>
                    ))}
                  </span>
                </label>
                {d.selected && (
                  <div className="mt-3">
                    <div className="text-sm">{d.kind === "percent" ? `Porcentaje de comisión: ${clampPercent(d.value)}%` : `Comisión fija: ${formatMoney(clampFixedCents(d.value), currency)}`}</div>
                    <input className="mt-3 w-full accent-[#2F5BFF]" type="range" min={0} max={d.kind === "percent" ? 100 : max} step={d.kind === "percent" ? 1 : 50} value={d.value} onChange={(e) => patchDraft(d.memberId, { value: Number(e.target.value) })} />
                    <div className="text-xs text-white/50">{commissionLabel(d.kind, d.value)} · base neta de descuento</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-3 pt-2">
        {onCancel ? <button type="button" className="font-bold text-[#2F5BFF]" onClick={onCancel}>Cancelar</button> : <span />}
        <button className="btn" disabled={busy}>{busy ? "Guardando…" : submitLabel}</button>
      </div>
      {priceCents > 0 && <p className="text-xs text-ink/40">Precio de lista {formatMoney(priceCents, currency)}{draft.price && draft.price !== centsToInput(priceCents) ? "" : ""}.</p>}
    </form>
  );
}
