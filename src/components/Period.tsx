"use client";
import { addDays, localDate, localToUtcMs, weekStart } from "@/lib/time";
export type PeriodKind = "day" | "week" | "month";
export function periodRange(kind: PeriodKind, anchor: string, tz: string) {
  let start = anchor, end = addDays(anchor, 1);
  if (kind === "week") { start = weekStart(anchor); end = addDays(start, 7); }
  if (kind === "month") { start = anchor.slice(0, 8) + "01"; const [y, m] = start.split("-").map(Number); end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); }
  return { start, end, from: new Date(localToUtcMs(start, "00:00", tz)).toISOString(), to: new Date(localToUtcMs(end, "00:00", tz)).toISOString() };
}
export function PeriodPicker({ kind, setKind, anchor, setAnchor, tz }: { kind: PeriodKind; setKind: (k: PeriodKind) => void; anchor: string; setAnchor: (a: string) => void; tz: string }) {
  return (
    <div className="mb-3 space-y-2">
      <div className="flex gap-2">{([["day", "Día"], ["week", "Semana"], ["month", "Mes"]] as const).map(([k, l]) => <button key={k} className={`chip ${kind === k ? "chip-on" : "bg-white"}`} onClick={() => setKind(k)}>{l}</button>)}
        <button className="chip bg-white" onClick={() => setAnchor(localDate(Date.now(), tz))}>Hoy</button></div>
      <input type="date" className="inp" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
    </div>
  );
}
