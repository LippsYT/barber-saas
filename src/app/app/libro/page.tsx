"use client";
import { useEffect, useState } from "react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { formatMoney, formatSigned } from "@/lib/money";
import { balance, MONEY_ACCOUNTS, type LedgerAccount } from "@/lib/ledger";
import { LedgerCalc } from "@/components/LedgerCalc";
import { PeriodPicker, periodRange, type PeriodKind } from "@/components/Period";
import { localDate } from "@/lib/time";

const TYPE_ES: Record<string, string> = { sale_income: "Venta", tip_income: "Propina", void_reversal: "Anulación", expense: "Gasto", commission_accrual: "Comisión", salary_accrual: "Sueldo", payout: "Pago a personal", cash_in: "Ingreso", cash_out: "Retiro", opening_float: "Fondo", adjustment: "Ajuste", refund: "Devolución" };
const ACC: [string, LedgerAccount[]][] = [["Dinero del negocio (todo)", MONEY_ACCOUNTS], ["Efectivo", ["cash"]], ["Tarjeta", ["card_clearing"]], ["Banco / transferencias", ["bank"]], ["Debido al personal", ["payable_staff"]]];

export default function Libro() {
  const { biz } = useApp();
  const [kind, setKind] = useState<PeriodKind>("day"); const [anchor, setAnchor] = useState(localDate(Date.now(), biz.timezone));
  const [entries, setEntries] = useState<any[]>([]); const [open, setOpen] = useState<string | null>(null);
  const load = async () => {
    const r = periodRange(kind, anchor, biz.timezone);
    const { data } = await sb().from("ledger_entries").select("*").eq("business_id", biz.id).gte("occurred_at", r.from).lt("occurred_at", r.to).order("seq");
    setEntries((data ?? []).map((e: any) => ({ ...e, amount: Number(e.amount) })));
  };
  useEffect(() => { load(); }, [kind, anchor]);
  async function voidSale(id: string) {
    const reason = prompt("Motivo de la anulación (queda registrado)"); if (!reason) return;
    const { error } = await sb().rpc("void_sale", { p_sale: id, p_reason: reason }); if (error) alert(errEs(error)); load();
  }
  const reversed = new Set(entries.map((e) => e.reversal_of).filter(Boolean));
  return (
    <main>
      <h1 className="h1">Libro de caja</h1>
      <p className="mb-3 text-sm text-gray-500">Nada se borra ni se edita: una anulación agrega un asiento inverso.</p>
      <PeriodPicker kind={kind} setKind={setKind} anchor={anchor} setAnchor={setAnchor} tz={biz.timezone} />
      <div className="mb-4 space-y-2">{ACC.map(([label, accs]) => { const es = entries.filter((e) => accs.includes(e.account)); return (
        <div key={label} className="card">
          <button className="flex w-full justify-between" onClick={() => setOpen(open === label ? null : label)}><span>{label}</span><span className="font-bold">{formatMoney(balance(es, accs), biz.currency)} <span className="text-xs font-normal underline">ver cálculo</span></span></button>
          {open === label && <div className="mt-2"><LedgerCalc entries={es} currency={biz.currency} /></div>}
        </div>); })}</div>
      <h2 className="mb-2 font-bold">Movimientos ({entries.length})</h2>
      <ul className="space-y-1">{entries.map((e) => (
        <li key={e.id} className="card py-2 text-sm">
          <div className="flex justify-between"><span>{TYPE_ES[e.type] ?? e.type} · {e.account === "payable_staff" ? "por pagar personal" : e.method ?? e.account}</span><span className={e.direction < 0 ? "text-red-700" : "text-green-700"}>{formatSigned(e.direction * e.amount, biz.currency)}</span></div>
          <div className="text-gray-600">{e.description}</div>
          <div className="flex justify-between text-xs text-gray-400"><span>{new Date(e.occurred_at).toLocaleString("es-CO", { timeZone: biz.timezone })}</span>
            {e.source_table === "sales" && e.type === "sale_income" && !e.reversal_of && !reversed.has(e.id) && <button className="underline" onClick={() => voidSale(e.source_id)}>Anular venta</button>}</div>
        </li>))}</ul>
    </main>
  );
}
