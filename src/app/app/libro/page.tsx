"use client";
import { useEffect, useState } from "react";
import { Banknote, Building2, ChevronDown, CreditCard, Users, Wallet } from "lucide-react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { formatMoney, formatSigned } from "@/lib/money";
import { balance, MONEY_ACCOUNTS, type LedgerAccount } from "@/lib/ledger";
import { LedgerCalc } from "@/components/LedgerCalc";
import { PeriodPicker, periodRange, type PeriodKind } from "@/components/Period";
import { localDate } from "@/lib/time";

const TYPE_ES: Record<string, string> = { sale_income: "Venta", tip_income: "Propina", void_reversal: "Anulación", expense: "Gasto", commission_accrual: "Comisión", salary_accrual: "Sueldo", payout: "Pago a personal", cash_in: "Ingreso", cash_out: "Retiro", opening_float: "Fondo", adjustment: "Ajuste", refund: "Devolución" };
const ACC: { label: string; hint: string; accs: LedgerAccount[]; icon: typeof Wallet }[] = [
  { label: "Efectivo", hint: "Billetes y monedas en la caja", accs: ["cash"], icon: Banknote },
  { label: "Tarjeta", hint: "Cobros con tarjeta", accs: ["card_clearing"], icon: CreditCard },
  { label: "Banco / transferencias", hint: "Dinero que entró al banco", accs: ["bank"], icon: Building2 },
  { label: "Debido al personal", hint: "Comisiones y sueldos por pagar", accs: ["payable_staff"], icon: Users },
];

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
  const all = entries.filter((e) => MONEY_ACCOUNTS.includes(e.account));
  const toggle = (k: string) => setOpen(open === k ? null : k);
  return (
    <main className="min-w-0">
      <div className="eyebrow mb-1">Todo lo que entra y sale</div>
      <h1 className="h1">Libro de caja</h1>
      <p className="mb-4 text-sm text-ink/60">Cada venta, gasto y retiro queda anotado. Nada se borra ni se edita: si algo se anula, se agrega un asiento inverso.</p>
      <PeriodPicker kind={kind} setKind={setKind} anchor={anchor} setAnchor={setAnchor} tz={biz.timezone} />

      <section className="mb-3 overflow-hidden rounded-[1.7rem] bg-ink p-4 text-white">
        <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#D6FF4A]">Dinero del negocio</div>
        <div className="mt-1 break-words font-display text-5xl font-extrabold leading-none">{formatMoney(balance(all, MONEY_ACCOUNTS), biz.currency)}</div>
        <p className="mt-2 text-sm text-white/65">Efectivo + tarjeta + banco en este período.</p>
        <button className="mt-3 inline-flex min-h-[44px] items-center gap-1 rounded-full bg-white/10 px-4 text-sm font-semibold" aria-expanded={open === "todo"} onClick={() => toggle("todo")}>
          Ver cómo se calcula <ChevronDown className={`h-4 w-4 transition ${open === "todo" ? "rotate-180" : ""}`} />
        </button>
        {open === "todo" && <div className="mt-3 rounded-2xl bg-white p-2 text-ink"><LedgerCalc entries={all} currency={biz.currency} /></div>}
      </section>

      <div className="mb-5 space-y-2">{ACC.map(({ label, hint, accs, icon: Icon }) => { const es = entries.filter((e) => accs.includes(e.account)); const isOpen = open === label; return (
        <div key={label} className="card min-w-0 p-3">
          <button className="flex w-full min-w-0 items-center gap-3 text-left" aria-expanded={isOpen} onClick={() => toggle(label)}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2F5BFF]/10 text-[#2F5BFF]"><Icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate font-bold">{label}</span><span className="block truncate text-xs text-ink/55">{hint}</span></span>
            <span className="shrink-0 text-right"><span className="block font-display text-2xl font-extrabold leading-none">{formatMoney(balance(es, accs), biz.currency)}</span><span className="mt-1 flex items-center justify-end gap-0.5 text-[11px] font-semibold text-[#1D3FD6]">Cómo se calcula <ChevronDown className={`h-3 w-3 transition ${isOpen ? "rotate-180" : ""}`} /></span></span>
          </button>
          {isOpen && <div className="mt-3"><LedgerCalc entries={es} currency={biz.currency} /></div>}
        </div>); })}</div>

      <h2 className="mb-2 font-display text-2xl font-extrabold uppercase leading-none">Movimientos <span className="text-ink/40">({entries.length})</span></h2>
      {!entries.length && <p className="card text-sm text-ink/60">No hay movimientos en este período. Cuando cobres una venta o anotes un gasto, aparecerá aquí.</p>}
      <ul className="space-y-2">{entries.map((e) => (
        <li key={e.id} className="card min-w-0 p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><div className="font-bold">{TYPE_ES[e.type] ?? e.type}</div><div className="text-xs text-ink/55">{e.account === "payable_staff" ? "Por pagar al personal" : e.method ?? e.account}</div></div>
            <div className={`shrink-0 font-display text-xl font-extrabold ${e.direction < 0 ? "text-red-700" : "text-[#14944A]"}`}>{formatSigned(e.direction * e.amount, biz.currency)}</div>
          </div>
          {e.description && <div className="mt-1 break-words text-ink/70">{e.description}</div>}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink/45"><span>{new Date(e.occurred_at).toLocaleString("es-CO", { timeZone: biz.timezone, dateStyle: "medium", timeStyle: "short" })}</span>
            {e.source_table === "sales" && e.type === "sale_income" && !e.reversal_of && !reversed.has(e.id) && <button className="min-h-[36px] rounded-full border border-red-200 px-3 font-semibold text-red-700" onClick={() => voidSale(e.source_id)}>Anular venta</button>}</div>
        </li>))}</ul>
    </main>
  );
}
