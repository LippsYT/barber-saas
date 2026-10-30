"use client";
import { formatMoney, toCents } from "@/lib/money";

export function AttendPanel({
  items, method, adjustment, tip, busy, error, onMethod, onAdjustment, onTip, onConfirm, onNoShow,
}: {
  items: { name: string; price: number }[];
  method: "cash" | "transfer";
  adjustment: string;
  tip: string;
  busy?: boolean;
  error?: string;
  onMethod: (m: "cash" | "transfer") => void;
  onAdjustment: (v: string) => void;
  onTip: (v: string) => void;
  onConfirm: () => void;
  onNoShow?: () => void;
}) {
  const reserved = items.reduce((s, i) => s + Number(i.price), 0);
  const adj = toCents(adjustment);
  const tipC = Math.max(0, toCents(tip));
  const tooLow = reserved + adj < 0;
  const total = (tooLow ? 0 : reserved + adj) + tipC;
  return (
    <div className="mt-3 space-y-3 border-t border-black/5 pt-3">
      <div>
        <div className="text-xs font-extrabold uppercase tracking-widest text-ink/40">Precio reservado</div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <p className="min-w-0 text-sm text-ink/70">{items.map((i) => i.name).join(" · ") || "Sin servicio"}</p>
          <div className="shrink-0 font-display text-2xl font-extrabold tabular-nums">{formatMoney(reserved)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0">
          <span className="lbl">Ajuste</span>
          <input className="inp" inputMode="decimal" placeholder="0.00" value={adjustment} onChange={(e) => onAdjustment(e.target.value)} />
          <span className="mt-1 block text-[11px] text-ink/45">Negativo resta, positivo suma</span>
        </label>
        <label className="min-w-0">
          <span className="lbl">Propina</span>
          <input className="inp" inputMode="decimal" placeholder="0.00" value={tip} onChange={(e) => onTip(e.target.value)} />
        </label>
      </div>
      <div>
        <div className="lbl">¿Cómo pagó?</div>
        <div className="grid grid-cols-2 gap-2">
          {([["cash", "Efectivo"], ["transfer", "Transferencia"]] as const).map(([id, label]) => (
            <button key={id} type="button" className={`rounded-2xl border px-3 py-3 text-sm font-extrabold ${method === id ? "border-[#2F5BFF] bg-[#2F5BFF] text-white" : "border-border bg-white"}`} onClick={() => onMethod(id)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-[#F4F1E8] px-3 py-3">
        <span className="text-sm font-bold">Total a cobrar</span>
        <span className="font-display text-2xl font-extrabold tabular-nums">{formatMoney(total)}</span>
      </div>
      {tooLow && <p className="text-sm text-red-600">El ajuste deja el precio por debajo de cero.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn w-full" disabled={busy || tooLow || !items.length} onClick={onConfirm}>{busy ? "Guardando…" : "Marcar atendida"}</button>
      {onNoShow && <button className="btn2 w-full" disabled={busy} onClick={onNoShow}>No asistió</button>}
    </div>
  );
}
