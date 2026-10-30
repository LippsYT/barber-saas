"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { addDays, localDate, localTime, localToUtcMs } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { CalendarX2, Plus, Globe2, ChevronLeft, ChevronRight } from "lucide-react";
import { Empty } from "@/components/ui/empty";
import { Avatar } from "@/components/ui/avatar";

const ST: Record<string, [string, string]> = {
  reserved: ["Reservada", "bg-sky-100 text-sky-900 border-l-sky-400"], confirmed: ["Confirmada", "bg-indigo-100 text-indigo-900 border-l-indigo-400"], in_progress: ["En curso", "bg-gold/20 text-gold-700 border-l-gold"],
  completed: ["Completada", "bg-emerald-100 text-emerald-900 border-l-emerald-500"], no_show: ["No asistió", "bg-stone-200 text-stone-700 border-l-stone-400"], cancelled: ["Cancelada", "bg-red-100 text-red-800 border-l-red-400"],
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
  const live = shown.filter((a) => !["cancelled", "no_show"].includes(a.status));
  const expected = live.reduce((t, a) => t + a.items.reduce((x: number, it: any) => x + Number(it.price), 0), 0);
  const isToday = day === localDate(Date.now(), biz.timezone);
  const dayLabel = new Date(day + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  return (
    <main>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div><div className="eyebrow">{isToday ? "Hoy" : "Agenda"}</div><h1 className="font-display text-3xl font-semibold first-letter:uppercase">{dayLabel}</h1></div>
        <div className="flex items-center gap-1">
          <button aria-label="Día anterior" className="btn2 h-10 w-10 p-0" onClick={() => setDay(addDays(day, -1))}><span className="sr-only">‹</span><ChevronLeft className="h-4 w-4" /></button>
          <button aria-label="Día siguiente" className="btn2 h-10 w-10 p-0" onClick={() => setDay(addDays(day, 1))}>›</button>
        </div>
      </div>
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="card"><div className="text-xs text-muted-foreground">Citas</div><div className="stat">{live.length}</div></div>
        <div className="card"><div className="text-xs text-muted-foreground">Cobradas</div><div className="stat">{shown.filter((a) => paid.has(a.id)).length}</div></div>
        <div className="card bg-ink text-cream"><div className="text-xs text-cream/60">Ingreso esperado</div><div className="stat text-lg leading-none text-gold-300 sm:text-2xl md:text-3xl">{formatMoney(expected, biz.currency)}</div></div>
      </div>
      <div className="mb-4 flex items-center gap-2"><input type="date" className="inp py-2" value={day} onChange={(e) => setDay(e.target.value)} /></div>
      {role !== "barber" && <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button className={`chip ${!filter ? "chip-on" : "bg-card"}`} onClick={() => setFilter("")}>Todos</button>
        {members.map((m) => <button key={m.id} className={`chip whitespace-nowrap ${filter === m.id ? "chip-on" : "bg-card"}`} onClick={() => setFilter(m.id)}>{m.display_name}</button>)}
      </div>}
      <button className="btn-gold mb-4 w-full" onClick={() => setForm(!form)}>{form ? "Cerrar" : <><Plus className="h-4 w-4" />Nueva cita</>}</button>
      {form && <form onSubmit={create} className="card mb-4 space-y-2">
        {role !== "barber" && <select className="inp" required value={f.member} onChange={(e) => setF({ ...f, member: e.target.value })}><option value="">Barbero…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select>}
        <select className="inp" required value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}><option value="">Servicio…</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_min} min · {formatMoney(s.price, biz.currency)}</option>)}</select>
        <input className="inp" type="time" step={900} required value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        <input className="inp" placeholder="Nombre del cliente" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="inp" placeholder="WhatsApp del cliente" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <button className="btn w-full">Guardar cita</button>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>}
      <ul className="space-y-3">{shown.map((a) => (
        <li key={a.id} className={`card border-l-4 ${ST[a.status][1].split(" ").find((c) => c.startsWith("border-l-"))} ${["cancelled", "no_show"].includes(a.status) ? "opacity-60" : ""}`}>
          <div className="flex items-start gap-3">
            <div className="w-14 shrink-0"><div className="font-display text-xl font-semibold tabular-nums">{localTime(Date.parse(a.starts_at), biz.timezone)}</div><div className="text-xs text-muted-foreground">{localTime(Date.parse(a.ends_at), biz.timezone)}</div></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{a.client?.full_name ?? "Sin cliente"}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ST[a.status][1].split(" ").filter((c) => !c.startsWith("border-l-")).join(" ")}`}>{ST[a.status][0]}</span>
                {paid.has(a.id) && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white">Pagada</span>}</div>
              <div className="text-sm">{a.items.map((i: any) => i.name).join(", ")}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Avatar name={a.member?.display_name ?? "?"} size={20} className="ring-1" />{a.member?.display_name}{a.source === "booking_link" && <span className="inline-flex items-center gap-1"><Globe2 className="h-3 w-3" />reservó online</span>}</div>
            </div>
          </div>
          {!["cancelled", "no_show"].includes(a.status) && <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
            {!paid.has(a.id) && <Link className="btn py-2 text-sm" href={`/app/cobro?cita=${a.id}`}>Cobrar</Link>}
            {a.status === "reserved" && <button className="btn2" onClick={() => setStatus(a, "confirmed")}>Confirmar</button>}
            {a.status !== "completed" && <button className="btn2" onClick={() => setStatus(a, "no_show")}>No asistió</button>}
            {a.status !== "completed" && <button className="btn2" onClick={() => setStatus(a, "cancelled")}>Cancelar</button>}
          </div>}
        </li>))}
      </ul>
      {!shown.length && <Empty icon={CalendarX2} title="No hay citas este día." text="Comparte tu link de reservas o agrega una cita manualmente." />}
    </main>
  );
}
