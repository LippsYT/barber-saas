"use client";
import { useEffect, useState } from "react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { formatMoney, toCents } from "@/lib/money";

export default function Servicios() {
  const { biz } = useApp();
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState(""); const [dur, setDur] = useState("30"); const [price, setPrice] = useState("");
  const [err, setErr] = useState("");
  const load = async () => { const { data } = await sb().from("services").select("*").eq("business_id", biz.id).order("name"); setList(data ?? []); };
  useEffect(() => { load(); }, []);
  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const { error } = await sb().from("services").insert({ business_id: biz.id, name: name.trim(), duration_min: Number(dur), price: toCents(price) });
    if (error) return setErr(errEs(error));
    setName(""); setPrice(""); load();
  }
  async function toggle(s: any) { await sb().from("services").update({ active: !s.active }).eq("id", s.id); load(); }
  return (
    <main>
      <h1 className="h1">Servicios</h1>
      <form onSubmit={add} className="card mb-4 grid grid-cols-2 gap-2">
        <div className="col-span-2"><label className="lbl">Nombre</label><input className="inp" required placeholder="Corte clásico" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="lbl">Duración (min)</label><input className="inp" type="number" min={5} step={5} required value={dur} onChange={(e) => setDur(e.target.value)} /></div>
        <div><label className="lbl">Precio (US$)</label><input className="inp" type="number" min={0} step="0.01" required placeholder="25.00" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <button className="btn col-span-2">Agregar servicio</button>
        {err && <p className="col-span-2 text-sm text-red-600">{err}</p>}
      </form>
      <ul className="space-y-2">{list.map((s) => (
        <li key={s.id} className="card flex items-center justify-between">
          <div><div className={s.active ? "font-medium" : "line-through text-gray-400"}>{s.name}</div><div className="text-sm text-muted-foreground">{s.duration_min} min · {formatMoney(s.price, biz.currency)}</div></div>
          <button className="btn2" onClick={() => toggle(s)}>{s.active ? "Desactivar" : "Activar"}</button>
        </li>))}
        {!list.length && <p className="text-muted-foreground">Agrega tu primer servicio. Todos los barberos lo podrán hacer.</p>}
      </ul>
    </main>
  );
}
