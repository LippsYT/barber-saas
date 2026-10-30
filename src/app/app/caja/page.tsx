"use client";
import { useEffect, useMemo, useState } from "react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { toCents } from "@/lib/money";
import { addDays, localDate, weekStart } from "@/lib/time";
import { periodRange, type PeriodKind } from "@/components/Period";
import { serviceBreakdown, settleAccounts, type MethodSplit, type SettleResult } from "@/lib/caja";
import { proratedFixed, type PayPeriod, type PayType } from "@/lib/payout";
import { CajaCierreView, CajaHoyView, CajaReportesView, CajaTabs, SettleCard } from "@/components/app/caja/views";

type Svc = { name: string; qty: number; unitPrice: number; total: number };
type DayPayload = {
  locked: boolean;
  services: Svc[];
  sentence: string;
  income: number;
  tips: number;
  expenses: number;
  net: number;
  byMethod: Record<string, MethodSplit>;
  expected: number;
  lines: { label: string; amount: number }[];
  expensesList: { id: string; description: string; amount: number; method: string }[];
  close: { counted: number; expected: number; difference: number; notes?: string | null } | null;
};

const emptyMethod = (): Record<string, MethodSplit> => ({
  cash: { in: 0, out: 0, net: 0 }, transfer: { in: 0, out: 0, net: 0 }, card: { in: 0, out: 0, net: 0 }, other: { in: 0, out: 0, net: 0 },
});

function num(v: unknown) { return Number(v ?? 0); }

function mapServices(rows: { name?: string; unit_price?: number; qty?: number; total?: number }[] | null): Svc[] {
  return (rows ?? []).map((r) => ({ name: String(r.name), qty: num(r.qty), unitPrice: num(r.unit_price), total: num(r.total) }));
}

function dayLabel(date: string) {
  const s = new Date(date + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Caja() {
  const { biz, isManager, role } = useApp();
  const today = localDate(Date.now(), biz.timezone);
  const [tab, setTab] = useState("hoy");
  const [day, setDay] = useState(today);
  const [dia, setDia] = useState<DayPayload | null>(null);
  const [kind, setKind] = useState<PeriodKind>("day");
  const [anchor, setAnchor] = useState(today);
  const [report, setReport] = useState<any>(null);
  const [expense, setExpense] = useState({ concept: "", amount: "", method: "cash", date: today });
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [advances, setAdvances] = useState<any[]>([]);
  const [payMethod, setPayMethod] = useState<"cash" | "transfer">("transfer");
  const [periodKind, setPeriodKind] = useState<"week" | "month">("week");
  const [advForm, setAdvForm] = useState({ member: "", amount: "", method: "cash", note: "" });
  const [team, setTeam] = useState<any[]>([]);

  useEffect(() => {
    const t = new URLSearchParams(location.search).get("tab");
    if (t && ["hoy", "cerrar", "reportes", "adelantos"].includes(t)) setTab(t);
  }, []);

  const loadDay = async (d = day) => {
    const { data, error } = await sb().rpc("caja_dia", { p_business: biz.id, p_day: d });
    if (error) { setErr(errEs(error)); return; }
    const raw = data as any;
    const services = mapServices(raw.services);
    const broken = serviceBreakdown(services.map((s) => ({ name: s.name, unitPrice: s.unitPrice, qty: s.qty })));
    const by = emptyMethod();
    for (const k of Object.keys(by)) {
      const m = raw.by_method?.[k];
      if (m) by[k] = { in: num(m.in), out: num(m.out), net: num(m.net) };
    }
    setDia({
      locked: !!raw.locked,
      services: broken.lines,
      sentence: broken.sentence,
      income: num(raw.income),
      tips: num(raw.tips),
      expenses: num(raw.expenses),
      net: num(raw.net),
      byMethod: by,
      expected: num(raw.expected_cash),
      lines: (raw.cash_lines ?? []).map((l: any) => ({ label: l.label, amount: num(l.amount) })),
      expensesList: (raw.expenses_list ?? []).map((e: any) => ({ id: e.id, description: e.description, amount: num(e.amount), method: e.method })),
      close: raw.close ? { counted: num(raw.close.counted), expected: num(raw.close.expected), difference: num(raw.close.difference), notes: raw.close.notes } : null,
    });
    setExpense((x) => ({ ...x, date: d }));
  };

  const loadReport = async () => {
    const range = periodRange(kind, anchor, biz.timezone);
    const to = addDays(range.end, -1);
    const { data, error } = await sb().rpc("caja_periodo", { p_business: biz.id, p_from: range.start, p_to: to });
    if (error) { setErr(errEs(error)); return; }
    setReport(data);
  };

  const loadAdvances = async () => {
    const [{ data: members }, { data: comps }, { data: comm }, { data: adv }, { data: pays }, { data: lines }] = await Promise.all([
      sb().from("memberships").select("id, display_name, active").eq("business_id", biz.id).eq("active", true).order("display_name"),
      sb().from("member_compensation").select("member_id, pay_type, fixed_salary, pay_period").eq("business_id", biz.id),
      sb().from("commission_entries").select("id, member_id, description, amount, occurred_at").eq("business_id", biz.id),
      sb().from("staff_advances").select("id, member_id, amount, note, given_at").eq("business_id", biz.id).order("given_at"),
      sb().from("payouts").select("id, member_id, status, carry_forward, carry_absorbed_by").eq("business_id", biz.id),
      sb().from("payout_lines").select("kind, ref_id, payout_id").eq("business_id", biz.id),
    ]);
    setTeam(members ?? []);
    const linkedC = new Set((lines ?? []).filter((l: any) => l.kind === "commission" && l.ref_id).map((l: any) => l.ref_id));
    const linkedA = new Set((lines ?? []).filter((l: any) => l.kind === "advance" && l.ref_id).map((l: any) => l.ref_id));
    const end = today;
    const start = periodKind === "week" ? weekStart(today) : today.slice(0, 8) + "01";
    const compOf = Object.fromEntries((comps ?? []).map((c: any) => [c.member_id, c]));
    const cards = (members ?? []).map((m: any) => {
      const commissions = (comm ?? []).filter((c: any) => c.member_id === m.id && !linkedC.has(c.id) && localDate(Date.parse(c.occurred_at), biz.timezone) <= end)
        .map((c: any) => ({ id: c.id, description: c.description, amount: num(c.amount) }));
      const openAdv = (adv ?? []).filter((a: any) => a.member_id === m.id && !linkedA.has(a.id) && localDate(Date.parse(a.given_at), biz.timezone) <= end)
        .map((a: any) => ({ id: a.id, note: a.note || "Adelanto", amount: num(a.amount) }));
      const carriedIn = (pays ?? []).filter((p: any) => p.member_id === m.id && (p.status === "approved" || p.status === "paid") && !p.carry_absorbed_by).reduce((s: number, p: any) => s + num(p.carry_forward), 0);
      const comp = compOf[m.id];
      const payType = (comp?.pay_type ?? "commission") as PayType;
      const fixed = payType === "commission" ? { amount: 0, note: "" } : proratedFixed(num(comp?.fixed_salary), (comp?.pay_period ?? "monthly") as PayPeriod, start, end);
      const settle: SettleResult = settleAccounts({ commissions: payType === "fixed" ? [] : commissions, advances: openAdv, carriedIn, fixed: fixed.amount, fixedNote: fixed.note });
      const show = commissions.length > 0 || openAdv.length > 0 || carriedIn > 0 || (adv ?? []).some((a: any) => a.member_id === m.id);
      return { member: m, settle, show };
    }).filter((c: { show: boolean }) => c.show);
    setAdvances(cards);
  };

  useEffect(() => { setErr(""); if (tab === "hoy" || tab === "cerrar") loadDay(); if (tab === "reportes") loadReport(); if (tab === "adelantos") loadAdvances(); }, [tab, day, kind, anchor, periodKind, biz.id]);

  const countedCents = counted === "" ? null : toCents(counted);
  const previewDiff = dia && countedCents !== null ? countedCents - dia.expected : null;

  async function saveExpense() {
    setErr(""); setBusy(true);
    const { error } = await sb().rpc("record_expense_on", { p_business: biz.id, p_amount: toCents(expense.amount), p_method: expense.method, p_description: expense.concept, p_on: expense.date });
    setBusy(false);
    if (error) return setErr(errEs(error));
    setExpense({ concept: "", amount: "", method: "cash", date: day });
    loadDay();
  }
  async function closeDay() {
    setErr(""); setBusy(true);
    const { error } = await sb().rpc("close_cash_day", { p_business: biz.id, p_day: day, p_counted: countedCents ?? 0, p_notes: notes || null });
    setBusy(false);
    if (error) return setErr(errEs(error));
    setCounted(""); setNotes(""); loadDay();
  }
  async function giveAdvance(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const { error } = await sb().rpc("register_advance", { p_business: biz.id, p_member: advForm.member, p_amount: toCents(advForm.amount), p_method: advForm.method, p_note: advForm.note || "Adelanto" });
    setBusy(false);
    if (error) return setErr(errEs(error));
    setAdvForm({ member: "", amount: "", method: "cash", note: "" });
    loadAdvances();
  }
  async function payOne(memberId: string) {
    setErr(""); setBusy(true);
    const end = today;
    const start = periodKind === "week" ? weekStart(today) : today.slice(0, 8) + "01";
    const { error } = await sb().rpc("pay_settlement", { p_business: biz.id, p_member: memberId, p_start: start, p_end: end, p_method: payMethod });
    setBusy(false);
    if (error) return setErr(errEs(error));
    loadAdvances();
  }

  const reportView = useMemo(() => {
    if (!report) return null;
    const by = emptyMethod();
    for (const k of Object.keys(by)) {
      const m = report.by_method?.[k];
      if (m) by[k] = { in: num(m.in), out: num(m.out), net: num(m.net) };
    }
    return { by, services: mapServices(report.services), barbers: (report.barbers ?? []).map((b: any) => ({ id: b.id, name: b.name, services: num(b.services), income: num(b.income), tips: num(b.tips), commission: b.commission === null || b.commission === undefined ? null : num(b.commission) })) };
  }, [report]);

  return (
    <main className="space-y-4">
      <CajaTabs tab={tab} onTab={setTab} showAdvances={isManager} />
      {(tab === "hoy" || tab === "cerrar") && !dia && <p className="text-sm text-ink/50">Cargando el día…</p>}
      {tab === "hoy" && dia && (
        <CajaHoyView
          dayLabel={dayLabel(day)} sentence={dia.sentence} income={dia.income} tips={dia.tips} expenses={dia.expenses} net={dia.net}
          services={dia.services} byMethod={dia.byMethod} expensesList={dia.expensesList} locked={dia.locked}
          expense={expense} onExpense={(p) => setExpense({ ...expense, ...p })} onSaveExpense={saveExpense} saving={busy} error={err}
          onPrev={() => setDay(addDays(day, -1))} onNext={() => day < today && setDay(addDays(day, 1))}
        />
      )}
      {tab === "cerrar" && dia && (
        <CajaCierreView
          dayLabel={dayLabel(day)} lines={dia.lines} expected={dia.expected} counted={counted} onCounted={setCounted}
          notes={notes} onNotes={setNotes} difference={previewDiff} locked={dia.locked} saved={dia.close}
          onClose={closeDay} closing={busy} error={err}
        />
      )}
      {tab === "reportes" && reportView && (
        <CajaReportesView
          kind={kind} onKind={setKind} anchor={anchor} onAnchor={setAnchor}
          income={num(report.income)} expenses={num(report.expenses)} net={num(report.net)} tips={num(report.tips)} advances={role === "barber" ? undefined : num(report.advances)}
          byMethod={reportView.by} services={reportView.services} barbers={reportView.barbers}
        />
      )}
      {tab === "reportes" && !reportView && <p className="text-sm text-ink/50">Armando el reporte…</p>}
      {tab === "adelantos" && isManager && (
        <div className="space-y-4">
          <div>
            <div className="eyebrow">Equipo</div>
            <h1 className="display text-4xl">Adelantos.</h1>
            <p className="mt-2 text-sm text-ink/60">Un adelanto es plata que ya le diste. En la liquidación se resta de lo que ganó. Si sobra, queda para la próxima.</p>
          </div>
          <div className="flex gap-2">
            {([["week", "Esta semana"], ["month", "Este mes"]] as const).map(([id, label]) => (
              <button key={id} className={`chip ${periodKind === id ? "chip-on" : ""}`} onClick={() => setPeriodKind(id)}>{label}</button>
            ))}
          </div>
          <form onSubmit={giveAdvance} className="card space-y-2">
            <div className="font-display text-lg font-extrabold uppercase">Dar un adelanto</div>
            <select className="inp" required value={advForm.member} onChange={(e) => setAdvForm({ ...advForm, member: e.target.value })}>
              <option value="">¿A quién?</option>
              {team.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className="inp" required inputMode="decimal" placeholder="Monto" value={advForm.amount} onChange={(e) => setAdvForm({ ...advForm, amount: e.target.value })} />
              <select className="inp" value={advForm.method} onChange={(e) => setAdvForm({ ...advForm, method: e.target.value })}>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>
            <input className="inp" placeholder="Nota, por ejemplo: pidió hoy" value={advForm.note} onChange={(e) => setAdvForm({ ...advForm, note: e.target.value })} />
            <button className="btn w-full" disabled={busy}>Registrar adelanto</button>
          </form>
          {err && <p className="text-sm text-red-600">{err}</p>}
          {advances.length === 0 && <p className="text-sm text-ink/50">Nadie tiene comisiones ni adelantos pendientes.</p>}
          {advances.map((c) => (
            <SettleCard
              key={c.member.id} name={c.member.display_name} lines={c.settle.lines} toPay={c.settle.toPay} carryOut={c.settle.carryOut}
              method={payMethod} onMethod={setPayMethod} onPay={() => payOne(c.member.id)} paying={busy} canPay={role === "owner"}
              hint={role === "owner" ? "Incluye lo que todavía no se liquidó, aunque sea de antes." : "Solo el dueño puede marcarla como pagada."}
            />
          ))}
        </div>
      )}
    </main>
  );
}
