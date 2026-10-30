"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { sb } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { formatMoney } from "@/lib/money";
import { localDate } from "@/lib/time";
import { PeriodPicker, periodRange, type PeriodKind } from "@/components/Period";
import { CommissionBreakdown } from "@/components/CommissionBreakdown";

export default function Reportes() {
  const { biz, role } = useApp();
  const [kind, setKind] = useState<PeriodKind>("day"); const [anchor, setAnchor] = useState(localDate(Date.now(), biz.timezone));
  const [rows, setRows] = useState<any[]>([]); const [comm, setComm] = useState<any[]>([]); const [exp, setExp] = useState(0); const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { (async () => {
    const r = periodRange(kind, anchor, biz.timezone);
    const [{ data: sales }, { data: c }, { data: m }] = await Promise.all([
      sb().from("sales").select("id, member_id, status, subtotal, discount, tip, total, items:sale_items(qty, item_type)").eq("business_id", biz.id).eq("status", "paid").gte("created_at", r.from).lt("created_at", r.to),
      sb().from("commission_entries").select("id, member_id, description, amount, rule_snapshot").eq("business_id", biz.id).gte("occurred_at", r.from).lt("occurred_at", r.to).order("occurred_at"),
      sb().from("memberships").select("id, display_name, role").eq("business_id", biz.id),
    ]);
    if (role !== "barber") { const { data: e } = await sb().from("expenses").select("amount").eq("business_id", biz.id).eq("status", "active").gte("created_at", r.from).lt("created_at", r.to); setExp((e ?? []).reduce((s: number, x: any) => s + Number(x.amount), 0)); }
    const byM = new Map<string, any>();
    for (const mm of m ?? []) byM.set(mm.id, { id: mm.id, name: mm.display_name, services: 0, sales: 0, income: 0, tips: 0, commission: 0 });
    for (const s of sales ?? []) { const x = byM.get(s.member_id); if (!x) continue; x.sales++; x.services += s.items.filter((i: any) => i.item_type === "service").reduce((a: number, i: any) => a + i.qty, 0); x.income += Number(s.subtotal) - Number(s.discount); x.tips += Number(s.tip); }
    for (const e of c ?? []) { const x = byM.get(e.member_id); if (x) x.commission += Number(e.amount); }
    setRows([...byM.values()].filter((x) => x.sales || x.commission)); setComm(c ?? []);
  })(); }, [kind, anchor]);
  const tot = rows.reduce((a, x) => ({ income: a.income + x.income, tips: a.tips + x.tips, commission: a.commission + x.commission }), { income: 0, tips: 0, commission: 0 });
  return (
    <main>
      <h1 className="h1">{role === "barber" ? "Mis servicios y comisiones" : "Reportes"}</h1>
      {role !== "barber" && <Link href="/app/caja?tab=reportes" className="btn2 mb-3">Ingresos, gastos y cierre</Link>}
      <PeriodPicker kind={kind} setKind={setKind} anchor={anchor} setAnchor={setAnchor} tz={biz.timezone} />
      {role !== "barber" && <div className="card mb-3 font-mono text-sm">
        <div className="flex justify-between"><span>Ingresos por servicios (neto)</span><span>{formatMoney(tot.income, biz.currency)}</span></div>
        <div className="flex justify-between"><span>+ Propinas</span><span>{formatMoney(tot.tips, biz.currency)}</span></div>
        <div className="flex justify-between"><span>− Gastos</span><span>{formatMoney(exp, biz.currency)}</span></div>
        <div className="flex justify-between"><span>− Comisiones generadas</span><span>{formatMoney(tot.commission, biz.currency)}</span></div>
        <div className="flex justify-between border-t font-bold"><span>= Resultado aprox.</span><span>{formatMoney(tot.income + tot.tips - exp - tot.commission, biz.currency)}</span></div>
      </div>}
      <ul className="space-y-2">{rows.map((x) => (
        <li key={x.id} className="card">
          <div className="font-display text-lg font-semibold">{x.name}</div>
          <div className="grid grid-cols-2 text-sm"><span>Servicios: {x.services}</span><span>Ventas: {x.sales}</span><span>Ingresos: {formatMoney(x.income, biz.currency)}</span><span>Propinas: {formatMoney(x.tips, biz.currency)}</span></div>
          <button className="mt-1 text-sm" onClick={() => setOpen(open === x.id ? null : x.id)}>Comisión: <b>{formatMoney(x.commission, biz.currency)}</b> <span className="underline">ver cálculo</span></button>
          {open === x.id && <div className="mt-2"><CommissionBreakdown entries={comm.filter((c) => c.member_id === x.id)} currency={biz.currency} /></div>}
        </li>))}
        {!rows.length && <p className="text-muted-foreground">Sin ventas en este período.</p>}
      </ul>
    </main>
  );
}
