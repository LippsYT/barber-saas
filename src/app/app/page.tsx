"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { addDays, localDate, localTime, localToUtcMs } from "@/lib/time";
import { formatMoney } from "@/lib/money";

const ST: Record<string, [string, string]> = {
  reserved: ["Reservada", "bg-blue-100"], confirmed: ["Confirmada", "bg-blue-200"], in_progress: ["En curso", "bg-yellow-100"],
  completed: ["Completada", "bg-green-100"], no_show: ["No asistió", "bg-gray-200"], cancelled: ["Cancelada", "bg-red-100"],
};

export default function Agenda() {
  const { biz, role, memberId } = useApp();
  const [day, setDay] = useState(localDate(Date.now(), biz.timezone));
  const [members, setMembers] = useState<any[]>([]); const [services, setServices] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]); const [paid, setPaid] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>(""); const [form, setForm] = useState(false);
  const [f, setF] = useState({ member: role === "barber" ? memberId : "", service: "", time: "10:00", name: "", phone: "" });
  const [err, setErr] = useState("");
  useEffect(() => { (async () => {
    const [{ data: m }, { data: s }] = await Promise.all([
      sb().from("memberships").select("id, display_name").eq("business_id", biz.id).eq("is_bookable", true).eq("active", true).order("display_name"),
      sb().from("services").select("*").eq("business_id", biz.id).eq("active", true).order("name"),
    ]);
    setMembers(m ?? []); setServices(s ?? []);
  })(); }, []);
  const load = async () => {
    const from = new Date(localToUtcMs(day, "00:00", biz.timezone)).toISOString();
    const to = new Date(localToUtcMs(addDays(day, 1), "00:00", biz.timezone)).toISOString();
    const { data } = await sb().from("appointments").select("*, client:clients(full_name, phone), member:memberships(display_name), items:appointment_items(name, price)")
      .eq("business_id", biz.id).gte("starts_at", from).lt("starts_at", to).order("starts_at");
    setAppts(data ?? []);
    const ids = (data ?? []).map((a: any) => a.id);
    if (ids.length) { const { data: s } = await sb().from("sales").select("appointment_id").in("appointment_id", ids).eq("status", "paid"); setPaid(new Set((s ?? []).map((x: any) => x.appointment_id))); }
  };
  useEffect(() => { load(); }, [day]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const svc = services.find((s) => s.id === f.service); if (!svc || !f.member) return setErr("Elige barbero y servicio.");
    let clientId: string | null = null;
    const phone = f.phone.replace(/\D/g, "");
    if (phone) { const { data } = await sb().from("clients").select("id").eq("business_id", biz.id).eq("phone", phone).maybeSingle(); clientId = data?.id ?? null; }
    if (!clientId && f.name.trim()) {
      const { data, error } = await sb().from("clients").insert({ business_id: biz.id, full_name: f.name.trim(), phone: phone || null }).select("id").single();
      if (error) return setErr(errEs(error)); clientId = data.id;
    }
    const start = localToUtcMs(day, f.time, biz.timezone);
    const { data: a, error } = await sb().from("appointments").insert({ business_id: biz.id, member_id: f.member, client_id: clientId, starts_at: new Date(start).toISOString(), ends_at: new Date(start + svc.duration_min * 60000).toISOString(), source: "admin" }).select("id").single();
    if (error) return setErr(errEs(error));
    await sb().from("appointment_items").insert({ business_id: biz.id, appointment_id: a.id, service_id: svc.id, name: svc.name, price: svc.price, duration_min: svc.duration_min });
    setForm(false); setF({ ...f, name: "", phone: "" }); load();
  }
  async function setStatus(a: any, status: string) {
    const patch: any = { status };
    if (status === "cancelled") { const r = prompt("Motivo de la cancelación"); if (r === null) return; patch.cancel_reason = r; }
    const { error } = await sb().from("appointments").update(patch).eq("id", a.id);
    if (error) alert(errEs(error)); load();
  }
  const shown = appts.filter((a) => !filter || a.member_id === filter);
  return (
    <main>
      <div className="mb-3 flex items-center gap-2">
        <button className="btn2" onClick={() => setDay(addDays(day, -1))}>‹</button>
        <input type="date" className="inp" value={day} onChange={(e) => setDay(e.target.value)} />
        <button className="btn2" onClick={() => setDay(addDays(day, 1))}>›</button>
      </div>
      {role !== "barber" && <div className="mb-3 flex gap-2 overflow-x-auto">
        <button className={`chip ${!filter ? "chip-on" : "bg-white"}`} onClick={() => setFilter("")}>Todos</button>
        {members.map((m) => <button key={m.id} className={`chip whitespace-nowrap ${filter === m.id ? "chip-on" : "bg-white"}`} onClick={() => setFilter(m.id)}>{m.display_name}</button>)}
      </div>}
      <button className="btn mb-3 w-full" onClick={() => setForm(!form)}>{form ? "Cerrar" : "+ Nueva cita"}</button>
      {form && <form onSubmit={create} className="card mb-4 space-y-2">
        {role !== "barber" && <select className="inp" required value={f.member} onChange={(e) => setF({ ...f, member: e.target.value })}><option value="">Barbero…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select>}
        <select className="inp" required value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}><option value="">Servicio…</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_min} min · {formatMoney(s.price, biz.currency)}</option>)}</select>
        <input className="inp" type="time" step={900} required value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        <input className="inp" placeholder="Nombre del cliente" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="inp" placeholder="WhatsApp del cliente" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <button className="btn w-full">Guardar cita</button>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>}
      <ul className="space-y-2">{shown.map((a) => (
        <li key={a.id} className={`card ${ST[a.status][1]}`}>
          <div className="flex justify-between"><b>{localTime(Date.parse(a.starts_at), biz.timezone)}–{localTime(Date.parse(a.ends_at), biz.timezone)}</b><span className="text-xs">{ST[a.status][0]}{paid.has(a.id) && " · Pagada"}</span></div>
          <div>{a.client?.full_name ?? "Sin cliente"} · {a.items.map((i: any) => i.name).join(", ")}</div>
          <div className="text-sm text-gray-600">{a.member?.display_name}{a.source === "booking_link" && " · reservó online"}</div>
          {!["cancelled", "no_show"].includes(a.status) && <div className="mt-2 flex flex-wrap gap-2">
            {!paid.has(a.id) && <Link className="btn2 bg-black text-white" href={`/app/cobro?cita=${a.id}`}>Cobrar</Link>}
            {a.status === "reserved" && <button className="btn2" onClick={() => setStatus(a, "confirmed")}>Confirmar</button>}
            {a.status !== "completed" && <button className="btn2" onClick={() => setStatus(a, "no_show")}>No asistió</button>}
            {a.status !== "completed" && <button className="btn2" onClick={() => setStatus(a, "cancelled")}>Cancelar</button>}
          </div>}
        </li>))}
        {!shown.length && <p className="text-center text-gray-500">No hay citas este día.</p>}
      </ul>
    </main>
  );
}
