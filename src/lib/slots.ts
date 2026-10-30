export interface Interval { start: number; end: number } // epoch ms, [start,end)

export interface SlotParams {
  windows: Interval[]; // horario laboral del día ya en UTC
  busy: Interval[]; // citas activas + time_off
  durationMin: number;
  stepMin: number;
  now: number;
  minNoticeMin: number;
  maxAdvanceDays: number;
}

const MIN = 60000;

/** Slots de inicio posibles: alineados al paso desde el inicio de cada ventana; la cita completa debe caber. */
export function generateSlots(p: SlotParams): Interval[] {
  const out: Interval[] = [];
  const earliest = p.now + p.minNoticeMin * MIN;
  const latest = p.now + p.maxAdvanceDays * 86400000;
  for (const w of p.windows) {
    for (let s = w.start; s + p.durationMin * MIN <= w.end; s += p.stepMin * MIN) {
      const e = s + p.durationMin * MIN;
      if (s < earliest || s > latest) continue;
      if (p.busy.some((b) => s < b.end && e > b.start)) continue;
      out.push({ start: s, end: e });
    }
  }
  return out;
}
