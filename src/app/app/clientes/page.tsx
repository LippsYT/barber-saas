"use client";
import { useEffect, useState } from "react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { formatMoney } from "@/lib/money";
import { MessageCircle } from "lucide-react";
import { toE164, waHref } from "@/lib/phone";


export default function Clientes() {
  const { biz } = useApp();
  const [q, setQ] = useState(""); const [list, setList] = useState<any[]>([]); const [sel, setSel] = useState<any>(null); const [hist, setHist] = useState<any>({ appts: [], sales: [] });
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [err, setErr] = useState("");
  const load = async () => {
    let r = sb().from("clients").select("*").eq("business_id", biz.id).order("full_name").limit(100);
    if (q) r = r.or(`full_name.ilike.%${q.replace(/[%,()]/g, "")}%,phone.ilike.%${q.replace(/\D/g, "").replace(/^0+/, "")}%`);
    const { data } = await r; setList(data ?? []);
  };
  useEffect(() => { load(); }, [q]);
  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const { error } = await sb().from("clients").insert({ business_id: biz.id, full_name: name.trim(), phone: toE164(phone) });
    if (error) return setErr(error.message.includes("clients_phone_uniq") ? "Ya existe un cliente con ese teléfono." : errEs(error));
    setName(""); setPhone(""); load();
  }
  async function open(c: any) {
    setSel(c);
    const [{ data: appts }, { data: sales }] = await Promise.all([
      sb().from("appointments").select("id, starts_at, status, member:memberships(display_name)").eq("client_id", c.id).order("starts_at", { ascending: false }).limit(20),
      sb().from("sales").select("id, number, total, status, created_at").eq("client_id", c.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setHist({ appts: appts ?? [], sales: sales ?? [] });
  }
  async function saveNotes() { await sb().from("clients").update({ notes: sel.notes }).eq("id", sel.id); }
  if (sel) return (
    <main>
      <button className="btn2 mb-3" onClick={() => setSel(null)}>← Clientes</button>
      <div className="card space-y-2">
        <div className="text-lg font-bold">{sel.full_name}</div>
        <div className="flex items-center justify-between gap-2 text-sm">{sel.phone ? <span>{sel.phone}</span> : <span>Sin teléfono</span>}{sel.phone && <a className="grid h-10 w-10 place-items-center rounded-full bg-[#25D366] text-white" href={waHref(sel.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp a ${sel.full_name}`}><MessageCircle className="h-5 w-5" /></a>}</div>
        <textarea className="inp" placeholder="Notas (ej. degradado bajo, alérgico a…)" value={sel.notes ?? ""} onChange={(e) => setSel({ ...sel, notes: e.target.value })} />
        <button className="btn2" onClick={saveNotes}>Guardar notas</button>
      </div>
      <h2 className="mt-4 font-bold">Citas</h2>
      <ul className="text-sm">{hist.appts.map((a: any) => <li key={a.id} className="border-b py-1">{new Date(a.starts_at).toLocaleString("es-CO", { timeZone: biz.timezone })} · {a.member?.display_name} · {a.status}</li>)}</ul>
      <h2 className="mt-4 font-bold">Pagos</h2>
      <ul className="text-sm">{hist.sales.map((s: any) => <li key={s.id} className="border-b py-1">Venta #{s.number} · {formatMoney(s.total, biz.currency)} · {s.status === "voided" ? "anulada" : "pagada"}</li>)}</ul>
    </main>
  );
  return (
    <main>
      <div className="mb-3 flex items-end justify-between"><h1 className="display text-4xl">Clientes</h1><span className="pill bg-[#D6FF4A]">{list.length}</span></div>
      <input className="inp mb-3" placeholder="Buscar por nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
      <form onSubmit={add} className="card mb-4 flex flex-col gap-2 sm:flex-row">
        <input className="inp" required placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="inp" placeholder="WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="btn">Agregar</button>
      </form>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <ul className="space-y-2">{list.map((c) => <li key={c.id} className="card flex items-center gap-3">
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => open(c)}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#2F5BFF] font-display text-lg font-extrabold text-white">{(c.full_name || "?").slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0"><span className="block truncate font-semibold">{c.full_name}</span><span className="block text-sm text-ink/50">{c.phone || "Sin teléfono"}</span></span>
        </button>
        {c.phone && <a className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#25D366] text-white" href={waHref(c.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp a ${c.full_name}`}><MessageCircle className="h-5 w-5" /></a>}
      </li>)}</ul>
    </main>
  );
}
