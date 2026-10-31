"use client";
import { useEffect, useState } from "react";
import { Banknote, Building2, CreditCard, Trash2, Wallet } from "lucide-react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";

type Method = "cash" | "card" | "transfer" | "other";
const METHODS: { key: Method; label: string; hint: string; icon: typeof Wallet }[] = [
  { key: "cash", label: "Efectivo", hint: "Billetes y monedas", icon: Banknote },
  { key: "card", label: "Tarjeta", hint: "Débito y crédito", icon: CreditCard },
  { key: "transfer", label: "Transferencia bancaria", hint: "Depósitos al banco", icon: Building2 },
  { key: "other", label: "Otro", hint: "Cualquier otro medio", icon: Wallet },
];
type Cat = { id: string; name: string };

export default function Finanzas() {
  const { biz, isManager } = useApp();
  const [methods, setMethods] = useState<Partial<Record<Method, boolean>>>({}); const [cats, setCats] = useState<Cat[]>([]);
  const [name, setName] = useState(""); const [err, setErr] = useState(""); const [note, setNote] = useState("");

  const load = async () => {
    const [{ data: b }, { data: c }] = await Promise.all([
      sb().from("businesses").select("settings").eq("id", biz.id).single(),
      sb().from("expense_categories").select("id,name").eq("business_id", biz.id).order("name"),
    ]);
    setMethods(((b?.settings as { payment_methods?: Partial<Record<Method, boolean>> } | null)?.payment_methods) ?? {}); setCats((c ?? []) as Cat[]);
  };
  useEffect(() => { load(); }, []);

  async function toggle(k: Method, v: boolean) {
    setErr(""); setNote("");
    const { data, error } = await sb().rpc("set_business_settings", { p_patch: { payment_methods: { [k]: v } } });
    if (error) return setErr(error.message.includes("bad_setting") ? "Debe quedar al menos un método de pago activo." : errEs(error));
    setMethods((data as { payment_methods?: Partial<Record<Method, boolean>> }).payment_methods ?? {}); setNote("Guardado. Ya aplica al cobrar.");
  }
  async function addCat(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const { error } = await sb().from("expense_categories").insert({ business_id: biz.id, name: name.trim() });
    if (error) return setErr(error.message.includes("duplicate") ? "Ese tipo de gasto ya existe." : errEs(error));
    setName(""); load();
  }
  async function delCat(c: Cat) {
    if (!confirm(`¿Quitar "${c.name}"? Los gastos ya anotados con este tipo se conservan.`)) return;
    const { error } = await sb().from("expense_categories").delete().eq("id", c.id);
    if (error) return setErr("No se puede quitar un tipo de gasto que ya tiene gastos anotados.");
    load();
  }

  return (
    <main className="min-w-0 space-y-4">
      <div><div className="eyebrow mb-1">Tu dinero</div><h1 className="h1 !mb-0">Pagos y gastos</h1></div>
      {note && <p role="status" className="text-sm text-[#0B5B2B]">{note}</p>}
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}

      <section className="space-y-2">
        <div className="font-display text-2xl font-extrabold uppercase leading-none">Métodos de pago</div>
        <p className="text-sm text-ink/60">Los que apagues no aparecen al cobrar una venta.</p>
        {METHODS.map(({ key, label, hint, icon: Icon }) => (
          <label key={key} className="card flex min-w-0 items-center gap-3 p-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2F5BFF]/10 text-[#2F5BFF]"><Icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block font-bold">{label}</span><span className="block text-xs text-ink/55">{hint}</span></span>
            <input type="checkbox" className="h-6 w-11 shrink-0 accent-[#2F5BFF]" aria-label={label} checked={methods[key] ?? true} disabled={!isManager} onChange={(e) => toggle(key, e.target.checked)} />
          </label>))}
      </section>

      <section className="space-y-2">
        <div className="font-display text-2xl font-extrabold uppercase leading-none">Tipos de gasto</div>
        <p className="text-sm text-ink/60">Categorías para ordenar tus gastos, por ejemplo: proveedores, pago de servicios o alimentación.</p>
        {isManager && <form onSubmit={addCat} className="card flex gap-2"><input className="inp min-w-0 flex-1" required maxLength={60} placeholder="Nuevo tipo de gasto" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn shrink-0">Agregar</button></form>}
        {!cats.length && <p className="card text-sm text-ink/55">Todavía no tienes tipos de gasto.</p>}
        <ul className="space-y-2">{cats.map((c) => (
          <li key={c.id} className="card flex min-w-0 items-center justify-between gap-3 p-3">
            <span className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#2F5BFF]/10 text-xs font-extrabold text-[#2F5BFF]">{c.name.slice(0, 2).toUpperCase()}</span><span className="min-w-0 break-words font-semibold">{c.name}</span></span>
            {isManager && <button aria-label={`Quitar ${c.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-sm" onClick={() => delCat(c)}><Trash2 className="h-4 w-4 text-red-600" /></button>}
          </li>))}</ul>
      </section>
    </main>
  );
}
