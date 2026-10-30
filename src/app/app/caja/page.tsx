"use client";
import { useEffect, useState } from "react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { formatMoney, formatSigned, toCents } from "@/lib/money";
import { USD_DENOMINATIONS, denominationsTotal, expectedCash, otherMethodsTotals } from "@/lib/cash";
import { LedgerCalc } from "@/components/LedgerCalc";

export default function Caja() {
  const { biz, isManager } = useApp();
  const [sess, setSess] = useState<any>(null); const [entries, setEntries] = useState<any[]>([]); const [loaded, setLoaded] = useState(false);
  const [float, setFloat] = useState("0"); const [counts, setCounts] = useState<Record<string, number>>({}); const [manual, setManual] = useState("");
  const [notes, setNotes] = useState(""); const [err, setErr] = useState(""); const [result, setResult] = useState<any>(null);
  const [exp, setExp] = useState({ amount: "", desc: "", method: "cash" }); const [history, setHistory] = useState<any[]>([]); const [details, setDetails] = useState(false);
  const load = async () => {
    const { data: s } = await sb().from("cash_sessions").select("*").eq("business_id", biz.id).eq("status", "open").maybeSingle();
    setSess(s);
    if (s) { const { data } = await sb().from("ledger_entries").select("*").eq("cash_session_id", s.id).order("seq"); setEntries((data ?? []).map((e: any) => ({ ...e, amount: Number(e.amount) }))); }
    const { data: h } = await sb().from("cash_sessions").select("*").eq("business_id", biz.id).eq("status", "closed").order("closed_at", { ascending: false }).limit(5);
    setHistory(h ?? []); setLoaded(true);
  };
  useEffect(() => { load(); }, []);
  async function open() { const { error } = await sb().rpc("open_cash_session", { p_business: biz.id, p_float: toCents(float) }); if (error) return setErr(errEs(error)); load(); }
  async function addExpense(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const { error } = await sb().rpc("record_expense", { p_business: biz.id, p_category: null, p_amount: toCents(exp.amount), p_method: exp.method, p_description: exp.desc });
    if (error) return setErr(errEs(error)); setExp({ amount: "", desc: "", method: "cash" }); load();
  }
  const cashEntries = entries.filter((e) => e.account === "cash");
  const calc = sess ? expectedCash(Number(sess.opening_float), cashEntries) : null;
  const byDen = denominationsTotal(counts);
  const counted = manual !== "" ? toCents(manual) : byDen;
  const diff = calc ? counted - calc.expected : 0;
  async function close() {
    setErr("");
    const { data, error } = await sb().rpc("close_cash_session", { p_session: sess.id, p_counted: counted, p_denominations: Object.keys(counts).length ? counts : null, p_notes: notes || null });
    if (error) return setErr(errEs(error)); setResult(data); setCounts({}); setManual(""); setNotes(""); load();
  }
  if (!loaded) return <p>Cargando…</p>;
  return (
    <main className="space-y-4">
      <div className="eyebrow">Caja</div>
      <h1 className="display text-4xl">Al centavo.</h1>
      {result && <div className="card border-emerald-200 bg-emerald-50 text-emerald-900">Caja cerrada. Esperado {formatMoney(result.expected, biz.currency)} · Contado {formatMoney(result.counted, biz.currency)} · Diferencia {formatMoney(result.difference, biz.currency)}</div>}
      {!sess ? (
        <div className="card space-y-3"><div className="font-display text-xl font-semibold">No hay caja abierta</div>
          <label className="lbl">Fondo inicial en efectivo</label><input className="inp" type="number" min={0} value={float} onChange={(e) => setFloat(e.target.value)} />
          <button className="btn w-full" onClick={open}>Abrir caja</button>
          <p className="text-xs text-muted-foreground">Si cobras sin abrir caja, se abre sola con fondo 0.</p></div>
      ) : (<>
        <div className="relative overflow-hidden rounded-[1.7rem] bg-white p-5 shadow-soft">
          <div className="text-xs font-extrabold uppercase tracking-widest text-ink/40">Saldo en caja</div>
          <div className="display mt-1 text-5xl text-[#14944A]">{formatMoney(calc!.expected, biz.currency)}</div>
          <div className="mt-2 text-sm text-ink/50">Fondo {formatMoney(calc!.opening_float, biz.currency)} · abierta {new Date(sess.opened_at).toLocaleString("es-CO", { timeZone: biz.timezone, dateStyle: "medium", timeStyle: "short" })}</div>
          <button className="mt-3 font-extrabold text-[#2F5BFF]" onClick={() => setDetails(!details)}>{details ? "Ocultar detalles" : "Ver detalles"}</button>
        </div>
        {details && <div className="card space-y-1">
          <div className="text-sm text-muted-foreground">Abierta {new Date(sess.opened_at).toLocaleString("es-CO", { timeZone: biz.timezone, dateStyle: "short", timeStyle: "short" })}</div>
          <div className="font-mono text-sm">
            <div className="flex justify-between"><span>Fondo inicial</span><span>{formatMoney(calc!.opening_float, biz.currency)}</span></div>
            {calc!.lines.map((l) => <div key={l.label} className="flex justify-between"><span>{l.label}</span><span>{formatSigned(l.amount, biz.currency)}</span></div>)}
            <div className="flex justify-between border-t font-bold"><span>= Efectivo esperado</span><span>{formatMoney(calc!.expected, biz.currency)}</span></div>
          </div>
          <details open><summary className="cursor-pointer text-sm font-bold underline">Ver cálculo (línea por línea)</summary><div className="mt-2"><LedgerCalc entries={cashEntries} currency={biz.currency} start={calc!.opening_float} startLabel="Fondo inicial" /></div></details>
          {isManager && Object.entries(otherMethodsTotals(entries)).map(([k, v]) => <div key={k} className="text-xs text-muted-foreground">Informativo · {k === "card_clearing" ? "Tarjeta" : "Banco/transferencia"}: {formatMoney(v, biz.currency)}</div>)}
        </div>}
        <form onSubmit={addExpense} className="card space-y-2"><div className="font-display text-lg font-semibold">Registrar gasto</div>
          <input className="inp" required placeholder="¿Qué se pagó? (ej. insumos)" value={exp.desc} onChange={(e) => setExp({ ...exp, desc: e.target.value })} />
          <div className="flex gap-2"><input className="inp" type="number" min={1} required placeholder="Monto" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} />
            <select className="inp" value={exp.method} onChange={(e) => setExp({ ...exp, method: e.target.value })}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="card">Tarjeta</option></select></div>
          <button className="btn2 w-full">Guardar gasto</button></form>
        <div className="card space-y-2"><div className="font-display text-lg font-semibold">Cierre de caja</div>
          <p className="text-sm text-muted-foreground">Cuenta los billetes y monedas:</p>
          <div className="grid grid-cols-3 gap-2">{USD_DENOMINATIONS.map((d) => (
            <label key={d} className="text-xs">{formatMoney(d, biz.currency)}<input className="inp py-2" type="number" min={0} value={counts[d] ?? ""} onChange={(e) => setCounts({ ...counts, [d]: Number(e.target.value) })} /></label>))}</div>
          <label className="lbl">…o escribe el total contado</label><input className="inp" type="number" min={0} placeholder={String(byDen)} value={manual} onChange={(e) => setManual(e.target.value)} />
          <div className="font-mono text-sm">
            <div className="flex justify-between"><span>Efectivo esperado</span><span>{formatMoney(calc!.expected, biz.currency)}</span></div>
            <div className="flex justify-between"><span>Efectivo contado</span><span>{formatMoney(counted, biz.currency)}</span></div>
            <div className={`flex justify-between font-bold ${diff === 0 ? "text-green-700" : "text-red-600"}`}><span>Diferencia (contado − esperado)</span><span>{formatMoney(diff, biz.currency)}</span></div>
          </div>
          {diff !== 0 && <textarea className="inp" placeholder="Explica la diferencia (obligatorio)" value={notes} onChange={(e) => setNotes(e.target.value)} />}
          <button className="btn w-full" onClick={close}>Cerrar caja</button></div>
      </>)}
      {err && <p className="text-sm text-red-600">{err}</p>}
      {isManager && history.length > 0 && <div className="card text-sm"><div className="font-display text-lg font-semibold">Últimos cierres</div>{history.map((h) => <div key={h.id} className="border-b py-1">{new Date(h.closed_at).toLocaleString("es-CO", { timeZone: biz.timezone })} · esperado {formatMoney(h.expected_cash, biz.currency)} · contado {formatMoney(h.counted_cash, biz.currency)} · dif. {formatMoney(h.difference, biz.currency)}{h.notes && ` · "${h.notes}"`}</div>)}</div>}
    </main>
  );
}
