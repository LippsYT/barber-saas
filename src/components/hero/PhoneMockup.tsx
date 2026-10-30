import { Calculator, CalendarDays, Percent, Wallet } from "lucide-react";

/** Static product frame. Shown when the 3D hero is skipped (mobile, low-end, reduced motion). */
export function PhoneMockup() {
  return (
    <div className="phone-float relative mx-auto w-[min(100%,290px)] shrink-0">
      <div className="absolute -inset-8 rounded-full bg-gold/25 blur-3xl" aria-hidden />
      <div className="relative rounded-[2.6rem] border border-white/15 bg-ink-800 p-2.5 shadow-[0_30px_80px_rgba(0,0,0,.45)]">
        <div className="overflow-hidden rounded-[2.1rem] bg-cream text-ink">
          <div className="flex items-center justify-between bg-ink px-5 pb-3 pt-7 text-cream">
            <div>
              <div className="font-display text-base">Barbería Demo</div>
              <div className="text-[10px] text-cream/60">Viernes 30 · Caja abierta</div>
            </div>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gold font-display text-sm text-ink">FD</div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <div className="rounded-xl bg-white p-3 shadow-soft">
              <div className="text-[10px] text-ink/50">Cobrado hoy</div>
              <div className="font-display text-xl font-semibold">US$ 485.00</div>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-soft">
              <div className="text-[10px] text-ink/50">Citas</div>
              <div className="font-display text-xl font-semibold">14</div>
            </div>
          </div>
          <div className="space-y-2 px-3">
            {(
              [
                ["9:30", "Carlos", "Corte + barba", "Cobrada"],
                ["10:20", "Andrés", "Corte clásico", "En curso"],
                ["11:00", "Carlos", "Barba", "Reservada"],
              ] as const
            ).map(([h, b, s, st]) => (
              <div key={h} className="flex items-center gap-3 rounded-xl bg-white p-2.5 shadow-soft">
                <div className="w-10 text-xs font-semibold tabular-nums">{h}</div>
                <div className="flex-1">
                  <div className="text-xs font-medium">{s}</div>
                  <div className="text-[10px] text-ink/50">con {b}</div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${st === "Cobrada" ? "bg-emerald-100 text-emerald-800" : st === "En curso" ? "bg-gold/25 text-gold-700" : "bg-ink/5"}`}
                >
                  {st}
                </span>
              </div>
            ))}
          </div>
          <div className="m-3 rounded-xl bg-ink p-3 text-cream">
            <div className="text-[10px] uppercase tracking-widest text-gold">Efectivo esperado</div>
            <div className="mt-1 space-y-0.5 font-mono text-[10px] text-cream/70">
              <div className="flex justify-between"><span>Fondo inicial</span><span>US$ 50.00</span></div>
              <div className="flex justify-between"><span>+ Ventas efectivo</span><span>US$ 310.00</span></div>
              <div className="flex justify-between"><span>− Gastos</span><span>US$ 12.00</span></div>
            </div>
            <div className="mt-1 flex justify-between border-t border-white/10 pt-1 font-display text-base">
              <span>Total</span>
              <span className="text-gold-300">US$ 348.00</span>
            </div>
          </div>
          <div className="flex justify-around border-t border-border bg-white py-2.5 text-ink/40">
            <CalendarDays className="h-4 w-4 text-ink" />
            <Wallet className="h-4 w-4" />
            <Calculator className="h-4 w-4" />
            <Percent className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
