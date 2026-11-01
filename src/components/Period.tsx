"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, localDate, localToUtcMs, weekStart } from "@/lib/time";
export type PeriodKind = "day" | "week" | "month";
export function periodRange(kind: PeriodKind, anchor: string, tz: string) {
  let start = anchor, end = addDays(anchor, 1);
  if (kind === "week") { start = weekStart(anchor); end = addDays(start, 7); }
  if (kind === "month") { start = anchor.slice(0, 8) + "01"; const [y, m] = start.split("-").map(Number); end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); }
  return { start, end, from: new Date(localToUtcMs(start, "00:00", tz)).toISOString(), to: new Date(localToUtcMs(end, "00:00", tz)).toISOString() };
}

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const parts = (d: string) => { const [y, m, day] = d.split("-").map(Number); return { y, m: m - 1, day, wd: new Date(d + "T00:00:00Z").getUTCDay() }; };
const short = (d: string, withYear: boolean) => { const p = parts(d); return `${p.day} ${MESES[p.m].slice(0, 3)}${withYear ? ` ${p.y}` : ""}`; };
/** Lo que se está viendo, en palabras: «Domingo 1 nov 2026», «26 oct – 1 nov 2026» o «Noviembre 2026». */
export function periodLabel(kind: PeriodKind, anchor: string): string {
  const p = parts(anchor);
  if (kind === "day") return `${DIAS[p.wd]} ${short(anchor, true)}`;
  if (kind === "month") return `${MESES[p.m].charAt(0).toUpperCase()}${MESES[p.m].slice(1)} ${p.y}`;
  const s = weekStart(anchor), e = addDays(s, 6);
  return `${short(s, s.slice(0, 4) !== e.slice(0, 4))} – ${short(e, true)}`;
}
/** Mueve el periodo uno atrás (-1) o adelante (+1): un día, una semana o un mes. */
export function shiftPeriod(kind: PeriodKind, anchor: string, dir: 1 | -1): string {
  if (kind === "day") return addDays(anchor, dir);
  if (kind === "week") return addDays(weekStart(anchor), 7 * dir);
  const [y, m] = anchor.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10);
}

export function PeriodPicker({ kind, setKind, anchor, setAnchor, tz }: { kind: PeriodKind; setKind: (k: PeriodKind) => void; anchor: string; setAnchor: (a: string) => void; tz: string }) {
  const today = localDate(Date.now(), tz);
  const current = periodRange(kind, anchor, tz).start === periodRange(kind, today, tz).start;
  const atEnd = periodRange(kind, anchor, tz).start >= periodRange(kind, today, tz).start; // no se navega al futuro
  return (
    <div className="mb-4 space-y-2">
      <div role="tablist" aria-label="Periodo" className="grid grid-cols-3 gap-1 rounded-full bg-black/5 p-1">
        {([["day", "Día"], ["week", "Semana"], ["month", "Mes"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={kind === k} className={`h-10 rounded-full text-sm font-bold transition ${kind === k ? "bg-[#2F5BFF] text-white shadow" : "text-ink/60"}`}
            onClick={() => { setKind(k); setAnchor(anchor > today ? today : anchor); }}>{l}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button aria-label="Periodo anterior" className="btn2 h-12 w-12 shrink-0 p-0" onClick={() => setAnchor(shiftPeriod(kind, anchor, -1))}><ChevronLeft className="mx-auto h-5 w-5" /></button>
        <label className="relative flex h-12 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-2xl bg-white px-3 text-center font-display text-lg font-extrabold shadow-soft">
          <span className="truncate">{periodLabel(kind, anchor)}</span>
          <input type="date" aria-label="Elegir otra fecha" max={today} value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
        <button aria-label="Periodo siguiente" disabled={atEnd} className="btn2 h-12 w-12 shrink-0 p-0 disabled:opacity-30" onClick={() => setAnchor(shiftPeriod(kind, anchor, 1))}><ChevronRight className="mx-auto h-5 w-5" /></button>
      </div>
      {!current && <button className="text-sm font-bold text-[#2F5BFF]" onClick={() => setAnchor(today)}>Volver a hoy</button>}
    </div>
  );
}
