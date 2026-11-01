import Link from "next/link";
import { formatMoney } from "@/lib/money";

export interface HomeFigure { label: string; value: string; hint?: string }
export interface HomeVisit { id: string; time: string; title: string; who: string }

export function HomeDash({
  greeting, business, monthLabel, salesCents, daysLeft, delta, figures, visits,
}: {
  greeting: string;
  business: string;
  monthLabel: string;
  salesCents: number;
  daysLeft: number;
  delta: number | null;
  figures: HomeFigure[];
  visits: HomeVisit[];
}) {
  return (
    <main className="space-y-4">
      <div>
        <div className="text-sm text-ink/50">{greeting}</div>
        <h1 className="display text-4xl">{business}</h1>
      </div>
      <section className="relative rounded-[1.7rem] bg-white p-5 shadow-soft">
        <div className="text-xs font-extrabold uppercase tracking-widest text-ink/40">Tus ventas · {monthLabel}</div>
        <div className="display mt-1 text-5xl text-[#14944A] sm:text-6xl">{formatMoney(salesCents)}</div>
        <div className="mt-1 text-sm text-ink/55">{daysLeft <= 0 ? "Último día del mes" : daysLeft === 1 ? "Queda 1 día del mes" : `Quedan ${daysLeft} días de ${monthLabel}`}</div>
        {delta !== null && <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${delta >= 0 ? "bg-[#D6FF4A] text-ink" : "bg-[#FFE1E7] text-[#7A0F24]"}`}>{delta >= 0 ? "+" : ""}{delta}% vs mes anterior</div>}
        {(() => {
          // Chispa habla: un consejo corto según cómo va el mes.
          const tip = salesCents === 0
            ? { pose: "point" as const, text: "Aún no hay ventas este mes. Comparte tu link de reservas y cobra tu primera cita." }
            : delta !== null && delta >= 0
              ? { pose: "heart" as const, text: `¡Vas ${delta}% arriba del mes pasado! Sigue así.` }
              : delta !== null
                ? { pose: "run" as const, text: `Vas ${Math.abs(delta)}% abajo del mes pasado. Escríbeles a tus clientes para llenar la agenda.` }
                : { pose: "wave" as const, text: "¡Buen mes! Cada cita cobrada suma a esta cifra." };
          return (
            <div className="mt-4 flex items-center gap-3 border-t border-black/5 pt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mascot/barbero.webp" alt="Chispa, el barbero de Pulso" width={288} height={438} className="pointer-events-none h-auto w-20 shrink-0" />
              <p className="rounded-2xl rounded-bl-sm bg-[#F4F1E8] px-3 py-2 text-sm font-semibold leading-snug text-ink/75">{tip.text}</p>
            </div>
          );
        })()}
      </section>
      <section>
        <h2 className="mb-2 font-display text-xl font-extrabold uppercase">Tus cifras · {monthLabel}</h2>
        <div className="grid grid-cols-2 gap-2">
          {figures.map((f) => (
            <div key={f.label} className="rounded-2xl bg-white p-3 shadow-soft">
              <div className="display text-2xl text-[#2F5BFF]">{f.value}</div>
              <div className="text-xs font-semibold text-ink/55">{f.label}</div>
              {f.hint && <div className="text-[11px] text-ink/40">{f.hint}</div>}
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-[1.5rem] bg-white p-4 shadow-soft">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold uppercase">Últimas citas</h2>
          <Link href="/app/agenda" className="text-sm font-bold text-[#2F5BFF]">Ver semana</Link>
        </div>
        {visits.length === 0 && <p className="text-sm text-ink/50">Todavía no hay citas este mes. Comparte tu link o crea una desde el botón de abajo.</p>}
        <ul className="space-y-2">
          {visits.map((v) => (
            <li key={v.id} className="flex items-center gap-3 rounded-2xl bg-[#F4F1E8] px-3 py-2">
              <div className="w-12 font-display text-lg font-extrabold">{v.time}</div>
              <div className="min-w-0"><div className="truncate font-semibold">{v.title}</div><div className="truncate text-xs text-ink/50">{v.who}</div></div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
