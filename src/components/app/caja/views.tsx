"use client";
import { formatMoney, formatSigned } from "@/lib/money";
import { AmountField } from "@/components/ui/NumPad";
import { METHOD_ES, differenceText, shareOf, type MethodSplit, type SettleLine } from "@/lib/caja";

export function CajaTabs({ tab, onTab, showAdvances }: { tab: string; onTab: (t: string) => void; showAdvances: boolean }) {
  const tabs = [["hoy", "Hoy"], ["cerrar", "Cerrar"], ["reportes", "Reportes"], ...(showAdvances ? [["adelantos", "Adelantos"]] : [])];
  return (
    <div className="flex gap-2 hscroll pb-1">
      {tabs.map(([id, label]) => (
        <button key={id} className={`chip shrink-0 ${tab === id ? "chip-on" : ""}`} onClick={() => onTab(id)}>{label}</button>
      ))}
    </div>
  );
}

function Signed({ amount }: { amount: number }) {
  return <span className={`shrink-0 tabular-nums ${amount < 0 ? "text-[#7A0F24]" : ""}`}>{formatSigned(amount)}</span>;
}

export function ServiceList({ lines }: { lines: { name: string; qty: number; unitPrice: number; total: number }[] }) {
  if (!lines.length) return <p className="text-sm text-ink/50">Cuando marques citas como atendidas, aparecen acá con el precio que tenían al reservarse.</p>;
  return (
    <ul className="space-y-2">
      {lines.map((l) => (
        <li key={`${l.name}-${l.unitPrice}`} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 break-words font-semibold">{l.qty} × {l.name}</span>
          <span className="shrink-0 text-right tabular-nums text-ink/70">{formatMoney(l.unitPrice)} <b className="text-ink">{formatMoney(l.total)}</b></span>
        </li>
      ))}
    </ul>
  );
}

export function CajaHoyView({
  dayLabel, sentence, income, tips, expenses, net, services, byMethod, expensesList, locked,
  expense, onExpense, onSaveExpense, saving, error, onPrev, onNext,
}: {
  dayLabel: string;
  sentence: string;
  income: number;
  tips: number;
  expenses: number;
  net: number;
  services: { name: string; qty: number; unitPrice: number; total: number }[];
  byMethod: Record<string, MethodSplit>;
  expensesList: { id: string; description: string; amount: number; method: string }[];
  locked: boolean;
  expense: { concept: string; amount: string; method: string; date: string };
  onExpense: (patch: Partial<{ concept: string; amount: string; method: string; date: string }>) => void;
  onSaveExpense: () => void;
  saving?: boolean;
  error?: string;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button className="btn2 h-10 w-10 p-0" aria-label="Día anterior" onClick={onPrev}>‹</button>
        <div className="min-w-0 text-center">
          <div className="eyebrow">Caja del día</div>
          <h1 className="truncate font-display text-2xl font-extrabold">{dayLabel}</h1>
        </div>
        <button className="btn2 h-10 w-10 p-0" aria-label="Día siguiente" onClick={onNext}>›</button>
      </div>
      {locked && <div className="rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-white">Este día está cerrado. Los números ya no se mueven.</div>}
      <section className="rounded-[1.7rem] bg-white p-5 shadow-soft">
        <div className="text-xs font-extrabold uppercase tracking-widest text-ink/40">Entró hoy</div>
        <div className="display mt-1 text-[clamp(2.4rem,11vw,3.4rem)] text-[#14944A]">{formatMoney(income)}</div>
        <p className="mt-2 text-sm leading-snug text-ink/70">{sentence}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[["Servicios", income - tips], ["Propinas", tips], ["Quedó", net]].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-[#F4F1E8] px-1 py-2">
              <div className="font-display text-sm font-extrabold tabular-nums sm:text-base">{formatMoney(Number(value))}</div>
              <div className="text-[10px] font-extrabold uppercase tracking-wide text-ink/45">{label}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="grid grid-cols-2 gap-2">
        {(["cash", "transfer"] as const).map((m) => (
          <div key={m} className="rounded-3xl bg-white p-4 shadow-soft">
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-ink/40">{METHOD_ES[m]}</div>
            <div className="mt-1 font-display text-2xl font-extrabold tabular-nums">{formatMoney(byMethod[m]?.in ?? 0)}</div>
            {(byMethod[m]?.out ?? 0) > 0 && <div className="text-xs text-ink/50">Salió {formatMoney(byMethod[m].out)}</div>}
          </div>
        ))}
      </section>
      <section className="card">
        <h2 className="mb-3 font-display text-xl font-extrabold uppercase">Por servicio</h2>
        <ServiceList lines={services} />
        {services.length > 0 && <div className="mt-3 flex justify-between border-t border-black/5 pt-2 text-sm font-extrabold"><span>Total servicios</span><span className="tabular-nums">{formatMoney(income - tips)}</span></div>}
      </section>
      <section className="card space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-extrabold uppercase">Gastos</h2>
          <span className="text-sm font-bold tabular-nums">{formatMoney(expenses)}</span>
        </div>
        {expensesList.length === 0 && <p className="text-sm text-ink/50">Todavía no anotaste gastos este día.</p>}
        <ul className="space-y-2">
          {expensesList.map((e) => (
            <li key={e.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 break-words">{e.description} <span className="text-ink/40">· {METHOD_ES[e.method] ?? e.method}</span></span>
              <span className="shrink-0 tabular-nums">{formatMoney(e.amount)}</span>
            </li>
          ))}
        </ul>
        {!locked && (
          <form className="space-y-2 border-t border-black/5 pt-3" onSubmit={(ev) => { ev.preventDefault(); onSaveExpense(); }}>
            <div className="font-semibold">Anotar un gasto</div>
            <input className="inp" required placeholder="Qué se pagó" value={expense.concept} onChange={(e) => onExpense({ concept: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <AmountField required label="Monto del gasto" placeholder="Monto" value={expense.amount} onChange={(v) => onExpense({ amount: v })} />
              <select className="inp" value={expense.method} onChange={(e) => onExpense({ method: e.target.value })}>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>
            <input className="inp" type="date" required value={expense.date} onChange={(e) => onExpense({ date: e.target.value })} />
            <button className="btn2 w-full" disabled={saving}>{saving ? "Guardando…" : "Guardar gasto"}</button>
          </form>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </div>
  );
}

export function CajaCierreView({
  dayLabel, lines, expected, counted, onCounted, notes, onNotes, difference, locked, saved, onClose, closing, error,
}: {
  dayLabel: string;
  lines: { label: string; amount: number }[];
  expected: number;
  counted: string;
  onCounted: (v: string) => void;
  notes: string;
  onNotes: (v: string) => void;
  difference: number | null;
  locked: boolean;
  saved?: { counted: number; expected: number; difference: number; notes?: string | null } | null;
  onClose: () => void;
  closing?: boolean;
  error?: string;
}) {
  const shownDiff = saved ? saved.difference : difference;
  return (
    <div className="space-y-4">
      <div>
        <div className="eyebrow">Cerrar el día</div>
        <h1 className="display text-4xl">{dayLabel}</h1>
      </div>
      <section className="rounded-[1.7rem] bg-ink p-5 text-white shadow-soft">
        <div className="text-xs font-extrabold uppercase tracking-widest text-white/50">Efectivo que debería haber</div>
        <div className="display mt-1 text-[clamp(2.4rem,11vw,3.4rem)] text-[#D6FF4A]">{formatMoney(saved?.expected ?? expected)}</div>
        <p className="mt-2 text-sm text-white/70">Solo cuenta el efectivo. La transferencia queda registrada, pero no está en el cajón.</p>
      </section>
      <section className="card space-y-2">
        <h2 className="font-display text-xl font-extrabold uppercase">De dónde sale</h2>
        {lines.length === 0 && <p className="text-sm text-ink/50">Hoy no hubo movimientos en efectivo.</p>}
        {lines.map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 break-words">{l.label}</span>
            <Signed amount={l.amount} />
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-black/5 pt-2 text-sm font-extrabold">
          <span>Debería haber</span>
          <span className="tabular-nums">{formatMoney(saved?.expected ?? expected)}</span>
        </div>
      </section>
      {locked && saved ? (
        <section className="card space-y-2">
          <div className="pill bg-[#D6FF4A] text-ink">Día cerrado</div>
          <div className="flex justify-between text-sm"><span>Contaste</span><b className="tabular-nums">{formatMoney(saved.counted)}</b></div>
          <div className="flex justify-between text-sm"><span>Diferencia</span><b className="tabular-nums">{formatMoney(saved.difference)}</b></div>
          <p className="text-sm font-semibold">{differenceText(saved.difference)}</p>
          {saved.notes && <p className="text-sm text-ink/70">Nota: {saved.notes}</p>}
        </section>
      ) : (
        <section className="card space-y-3">
          <label>
            <span className="lbl">¿Cuánto efectivo contaste?</span>
            <input className="inp text-lg" inputMode="decimal" placeholder="0.00" value={counted} onChange={(e) => onCounted(e.target.value)} />
          </label>
          {shownDiff !== null && (
            <div className={`rounded-2xl px-3 py-3 text-sm font-bold ${shownDiff === 0 ? "bg-emerald-50 text-emerald-900" : "bg-[#FFE1E7] text-[#7A0F24]"}`}>
              {differenceText(shownDiff)}
            </div>
          )}
          {shownDiff !== null && shownDiff !== 0 && (
            <label>
              <span className="lbl">¿Por qué no cuadra?</span>
              <textarea className="inp min-h-24" placeholder="Por ejemplo: faltó el vuelto de un billete" value={notes} onChange={(e) => onNotes(e.target.value)} />
            </label>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn w-full" disabled={closing || counted.trim() === ""} onClick={onClose}>{closing ? "Cerrando…" : "Cerrar este día"}</button>
          <p className="text-xs text-ink/45">Al cerrar, el día queda trabado: no se pueden sumar citas ni gastos con esta fecha.</p>
        </section>
      )}
    </div>
  );
}

export function MethodBars({ byMethod, income }: { byMethod: Record<string, MethodSplit>; income: number }) {
  return (
    <ul className="space-y-3">
      {(["cash", "transfer", "card", "other"] as const).filter((m) => (byMethod[m]?.in ?? 0) > 0 || (byMethod[m]?.out ?? 0) > 0).map((m) => (
        <li key={m}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="font-semibold">{METHOD_ES[m]}</span>
            <span className="tabular-nums">{formatMoney(byMethod[m].in)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/5">
            <div className="h-2 rounded-full bg-[#2F5BFF]" style={{ width: `${shareOf(byMethod[m].in, income)}%` }} />
          </div>
          {byMethod[m].out > 0 && <div className="mt-1 text-xs text-ink/45">Salió {formatMoney(byMethod[m].out)} · quedó {formatMoney(byMethod[m].net)}</div>}
        </li>
      ))}
    </ul>
  );
}

export function CajaReportesView({
  kind, onKind, anchor, onAnchor, income, expenses, net, tips, advances, byMethod, services, barbers,
}: {
  kind: "day" | "week" | "month";
  onKind: (k: "day" | "week" | "month") => void;
  anchor: string;
  onAnchor: (v: string) => void;
  income: number;
  expenses: number;
  net: number;
  tips: number;
  advances?: number;
  byMethod: Record<string, MethodSplit>;
  services: { name: string; qty: number; unitPrice: number; total: number }[];
  barbers: { id: string; name: string; services: number; income: number; tips: number; commission: number | null }[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="eyebrow">Reportes</div>
        <h1 className="display text-4xl">Cómo estuvo.</h1>
      </div>
      <div className="flex gap-2 hscroll pb-1">
        {([["day", "Día"], ["week", "Semana"], ["month", "Mes"]] as const).map(([id, label]) => (
          <button key={id} className={`chip shrink-0 ${kind === id ? "chip-on" : ""}`} onClick={() => onKind(id)}>{label}</button>
        ))}
      </div>
      <input className="inp" type="date" value={anchor} onChange={(e) => onAnchor(e.target.value)} />
      <section className="grid grid-cols-3 gap-2">
        {[["Entró", income, "text-[#14944A]"], ["Gastos", expenses, "text-ink"], ["Quedó", net, "text-[#2F5BFF]"]].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-3xl bg-white p-3 shadow-soft">
            <div className={`font-display text-lg font-extrabold tabular-nums leading-none ${color}`}>{formatMoney(Number(value))}</div>
            <div className="mt-1 text-[10px] font-extrabold uppercase tracking-wide text-ink/45">{label}</div>
          </div>
        ))}
      </section>
      <p className="text-xs text-ink/45">Quedó = lo que entró (servicios y propinas) menos los gastos. Lo que se le debe a cada barbero está en Adelantos, no se resta acá.{tips ? ` Propinas incluidas: ${formatMoney(tips)}.` : ""}{advances ? ` Adelantos dados: ${formatMoney(advances)}.` : ""}</p>
      <section className="card">
        <h2 className="mb-3 font-display text-xl font-extrabold uppercase">Por forma de pago</h2>
        <MethodBars byMethod={byMethod} income={Math.max(income, 1)} />
        {income === 0 && expenses === 0 && <p className="text-sm text-ink/50">Sin movimientos en este período.</p>}
      </section>
      <section className="card">
        <h2 className="mb-3 font-display text-xl font-extrabold uppercase">Por servicio</h2>
        <ServiceList lines={services} />
      </section>
      <section className="card">
        <h2 className="mb-3 font-display text-xl font-extrabold uppercase">Por barbero</h2>
        {!barbers.length && <p className="text-sm text-ink/50">Nadie cobró servicios en este período.</p>}
        <ul className="space-y-3">
          {barbers.map((b) => (
            <li key={b.id} className="rounded-2xl bg-[#F4F1E8] p-3">
              <div className="font-display text-lg font-extrabold">{b.name}</div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 text-sm">
                <span>Servicios</span><b className="text-right tabular-nums">{b.services}</b>
                <span>Ingresos</span><b className="text-right tabular-nums">{formatMoney(b.income)}</b>
                <span>Propinas</span><b className="text-right tabular-nums">{formatMoney(b.tips)}</b>
                {b.commission !== null && <><span>Comisión</span><b className="text-right tabular-nums">{formatMoney(b.commission)}</b></>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function SettleCard({ name, lines, toPay, carryOut, method, onMethod, onPay, paying, canPay, hint }: {
  name: string;
  lines: SettleLine[];
  toPay: number;
  carryOut: number;
  method: "cash" | "transfer";
  onMethod: (m: "cash" | "transfer") => void;
  onPay: () => void;
  paying?: boolean;
  canPay: boolean;
  hint?: string;
}) {
  return (
    <article className="card space-y-2">
      <h3 className="font-display text-2xl font-extrabold">{name}</h3>
      {lines.map((l, i) => (
        <div key={`${l.label}-${i}`} className={`flex items-baseline justify-between gap-3 text-sm ${l.op === "=" ? "border-t border-black/5 pt-2 font-extrabold" : ""}`}>
          <span className="min-w-0 break-words">{l.label}</span>
          <span className="shrink-0 tabular-nums">{l.op === "=" || l.op === "→" ? formatMoney(l.amount) : formatSigned(l.op === "−" ? -l.amount : l.amount)}</span>
        </div>
      ))}
      {carryOut > 0 && <p className="text-xs text-ink/55">Esos {formatMoney(carryOut)} se restan solos en la próxima liquidación. No hay que volver a anotarlos.</p>}
      {hint && <p className="text-xs text-ink/55">{hint}</p>}
      {canPay && (
        <>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {([["cash", "Pagar en efectivo"], ["transfer", "Transferencia"]] as const).map(([id, label]) => (
              <button key={id} type="button" className={`rounded-2xl border px-2 py-3 text-xs font-extrabold ${method === id ? "border-ink bg-ink text-white" : "border-border bg-white"}`} onClick={() => onMethod(id)}>{label}</button>
            ))}
          </div>
          <button className="btn w-full" disabled={paying} onClick={onPay}>{paying ? "Pagando…" : toPay > 0 ? `Marcar pagada · ${formatMoney(toPay)}` : "Marcar pagada · queda a cuenta"}</button>
        </>
      )}
    </article>
  );
}
