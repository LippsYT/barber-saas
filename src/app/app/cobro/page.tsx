"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { formatMoney, toCents } from "@/lib/money";
import { CommissionBreakdown } from "@/components/CommissionBreakdown";

const METHODS = [["cash", "Efectivo"], ["card", "Tarjeta"], ["transfer", "Transferencia"], ["other", "Otro"]] as const;

export default function Cobro() {
  const { biz, role, memberId } = useApp();
  const [members, setMembers] = useState<any[]>([]); const [services, setServices] = useState<any[]>([]);
  const [appt, setAppt] = useState<any>(null);
  const [member, setMember] = useState(role === "barber" ? memberId : ""); const [items, setItems] = useState<string[]>([]);
  const [discount, setDiscount] = useState("0"); const [tip, setTip] = useState("0");
  const [pays, setPays] = useState<{ method: string; amount: string }[]>([{ method: "cash", amount: "" }]);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState<any>(null);
  useEffect(() => { (async () => {
    const [{ data: m }, { data: s }] = await Promise.all([
      sb().from("memberships").select("id, display_name").eq("business_id", biz.id).eq("is_bookable", true).eq("active", true).order("display_name"),
      sb().from("services").select("*").eq("business_id", biz.id).eq("active", true).order("name"),
    ]);
    setMembers(m ?? []); setServices(s ?? []);
    const cita = new URLSearchParams(location.search).get("cita");
    if (cita) {
      const { data: a } = await sb().from("appointments").select("*, client:clients(full_name), items:appointment_items(service_id)").eq("id", cita).single();
      if (a) { setAppt(a); setMember(a.member_id); setItems(a.items.map((i: any) => i.service_id).filter(Boolean)); }
    }
  })(); }, []);
  const subtotal = items.reduce((s, id) => s + Number(services.find((x) => x.id === id)?.price ?? 0), 0);
  const total = subtotal - toCents(discount) + toCents(tip);
  const paid = pays.reduce((s, p) => s + toCents(p.amount), 0);
  const single = pays.length === 1;

  async function pay() {
    setErr(""); setBusy(true);
    const payments = (single ? [{ method: pays[0].method, amount: total }] : pays.map((p) => ({ method: p.method, amount: toCents(p.amount) }))).filter((p) => p.amount > 0);
    const { data, error } = await sb().rpc("pay_sale", { p_business: biz.id, p_appointment: appt?.id ?? null, p_client: appt?.client_id ?? null, p_member: member,
      p_items: items.map((id) => ({ item_type: "service", item_id: id })), p_discount: toCents(discount), p_tip: toCents(tip), p_payments: payments });
    if (error) { setBusy(false); return setErr(errEs(error)); }
    const [{ data: sale }, { data: comm }] = await Promise.all([
      sb().from("sales").select("*").eq("id", data).single(),
      sb().from("commission_entries").select("id, description, amount, rule_snapshot").eq("sale_id", data).order("created_at"),
    ]);
    setDone({ sale, comm: comm ?? [] }); setBusy(false);
  }
  if (done) return (
    <main className="space-y-4">
      <div className="card"><div className="text-lg font-bold text-green-700">✔ Cobrado · Venta #{done.sale.number}</div>
        <div className="font-mono text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(done.sale.subtotal, biz.currency)}</span></div>
          <div className="flex justify-between"><span>− Descuento</span><span>{formatMoney(done.sale.discount, biz.currency)}</span></div>
          <div className="flex justify-between"><span>+ Propina</span><span>{formatMoney(done.sale.tip, biz.currency)}</span></div>
          <div className="flex justify-between font-bold"><span>= Total</span><span>{formatMoney(done.sale.total, biz.currency)}</span></div>
        </div></div>
      <details className="card" open><summary className="cursor-pointer font-medium">Ver cálculo de la comisión</summary><div className="mt-2"><CommissionBreakdown entries={done.comm} currency={biz.currency} /></div></details>
      <div className="flex gap-2"><Link className="btn" href="/app">Volver a la agenda</Link><button className="btn2" onClick={() => location.assign("/app/cobro")}>Nuevo cobro</button></div>
    </main>
  );
  return (
    <main className="space-y-3">
      <h1 className="h1">Cobrar {appt && `· ${appt.client?.full_name ?? "cita"}`}</h1>
      {role !== "barber" && <select className="inp" value={member} onChange={(e) => setMember(e.target.value)}><option value="">¿Quién atendió?</option>{members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select>}
      <div className="card space-y-2"><div className="font-display text-lg font-semibold">Servicios</div>
        <div className="flex flex-wrap gap-2">{services.map((s) => { const on = items.includes(s.id); return (
          <button key={s.id} className={`chip ${on ? "chip-on" : "bg-card"}`} onClick={() => setItems(on ? items.filter((x) => x !== s.id) : [...items, s.id])}>{s.name} {formatMoney(s.price, biz.currency)}</button>); })}</div></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="lbl">Descuento</label><input className="inp" type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
        <div><label className="lbl">Propina</label><input className="inp" type="number" min={0} value={tip} onChange={(e) => setTip(e.target.value)} /></div>
      </div>
      <div className="card text-lg font-bold">Total: {formatMoney(total, biz.currency)}</div>
      <div className="card space-y-2"><div className="font-display text-lg font-semibold">¿Cómo paga?</div>
        {pays.map((p, i) => (<div key={i} className="flex gap-2">
          <select className="inp" value={p.method} onChange={(e) => setPays(pays.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))}>{METHODS.map((m) => <option key={m[0]} value={m[0]}>{m[1]}</option>)}</select>
          {!single && <input className="inp" type="number" placeholder="Monto" value={p.amount} onChange={(e) => setPays(pays.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />}
        </div>))}
        {single ? <button className="text-sm underline" onClick={() => setPays([{ method: pays[0].method, amount: (total / 100).toFixed(2) }, { method: "card", amount: "0" }])}>Dividir pago</button>
          : <p className={`text-sm ${paid === total ? "text-green-700" : "text-red-600"}`}>Suma pagos: {formatMoney(paid, biz.currency)} {paid !== total && `(faltan ${formatMoney(total - paid, biz.currency)})`}</p>}
      </div>
      <button className="btn w-full" disabled={busy || !member || !items.length || (!single && paid !== total)} onClick={pay}>{busy ? "Cobrando…" : `Cobrar ${formatMoney(total, biz.currency)}`}</button>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </main>
  );
}
