"use client";
import { useEffect, useMemo, useState } from "react";
import { toE164 } from "@/lib/phone";
import Link from "next/link";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { addDays, localDate, localTime, localToUtcMs, weekStart, weekdayOf } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { Plus, ChevronLeft, ChevronRight, Globe2 } from "lucide-react";
import { WeekGrid, type WeekBlock } from "@/components/app/WeekGrid";

const ST: Record<string, [string, string]> = {
  reserved: ["Reservada", "bg-sky-100 text-sky-900"], confirmed: ["Confirmada", "bg-indigo-100 text-indigo-900"], in_progress: ["En curso", "bg-[#D6FF4A] text-ink"],
  completed: ["Completada", "bg-emerald-100 text-emerald-900"], no_show: ["No asistió", "bg-stone-200 text-stone-700"], cancelled: ["Cancelada", "bg-red-100 text-red-800"],
};
const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function minutesIn(iso: string, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export default function Agenda() {
  const { biz, role, memberId } = useApp();
  const [day, setDay] = useState(localDate(Date.now(), biz.timezone));
  const [members, setMembers] = useState<{ id: string; display_name: string }[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [paid, setPaid] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState(false);
  const [f, setF] = useState({ member: role === "barber" ? memberId : "", service: "", time: "10:00", name: "", phone: "" });
  const [err, setErr] = useState("");

  useEffect(() => { if (new URLSearchParams(location.search).get("nueva") === "1") setForm(true); }, []);
  useEffect(() => { (async () => {
    const [{ data: m }, { data: s }] = await Promise.all([
      sb().from("memberships").select("id, display_name").eq("business_id", biz.id).eq("is_bookable", true).eq("active", true).order("display_name"),
      sb().from("services").select("*").eq("business_id", biz.id).eq("active", true).order("name"),
    ]);
    setMembers(m ?? []); setServices(s ?? []);
  })(); }, [biz.id]);

  const start = weekStart(day);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);

  const load = async () => {
    const from = new Date(localToUtcMs(start, "00:00", biz.timezone)).toISOString();
    const to = new Date(localToUtcMs(addDays(start, 7), "00:00", biz.timezone)).toISOString();
    const { data } = await sb().from("appointments").select("*, client:clients(full_name, phone), member:memberships(display_name), items:appointment_items(name, price)")
      .eq("business_id", biz.id).gte("starts_at", from).lt("starts_at", to).order("starts_at");
    setAppts(data ?? []);
    const ids = (data ?? []).map((a: { id: string }) => a.id);
    if (ids.length) {
      const { data: s } = await sb().from("sales").select("appointment_id").in("appointment_id", ids).eq("status", "paid");
      setPaid(new Set((s ?? []).map((x: { appointment_id: string }) => x.appointment_id)));
    } else setPaid(new Set());
  };
  useEffect(() => { load(); }, [start, biz.id]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const svc = services.find((s) => s.id === f.service); if (!svc || !f.member) return setErr("Elige barbero y servicio.");
    let clientId: string | null = null;
    const phone = toE164(f.phone);
    if (phone) { const { data } = await sb().from("clients").select("id").eq("business_id", biz.id).eq("phone", phone).maybeSingle(); clientId = data?.id ?? null; }
    if (!clientId && f.name.trim()) {
      const { data, error } = await sb().from("clients").insert({ business_id: biz.id, full_name: f.name.trim(), phone }).select("id").single();
      if (error) return setErr(errEs(error)); clientId = data.id;
    }
    const t0 = localToUtcMs(day, f.time, biz.timezone);
    const { data: a, error } = await sb().from("appointments").insert({ business_id: biz.id, member_id: f.member, client_id: clientId, starts_at: new Date(t0).toISOString(), ends_at: new Date(t0 + svc.duration_min * 60000).toISOString(), source: "admin" }).select("id").single();
    if (error) return setErr(errEs(error));
    await sb().from("appointment_items").insert({ business_id: biz.id, appointment_id: a.id, service_id: svc.id, name: svc.name, price: svc.price, duration_min: svc.duration_min });
    setForm(false); setF({ ...f, name: "", phone: "" }); load();
  }
  async function setStatus(a: { id: string }, status: string) {
    const patch: Record<string, string> = { status };
    if (status === "cancelled") { const r = prompt("Motivo de la cancelación"); if (r === null) return; patch.cancel_reason = r; }
    const { error } = await sb().from("appointments").update(patch).eq("id", a.id);
    if (error) alert(errEs(error));
    else if (status === "cancelled") fetch("/api/messages/kick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appointmentId: a.id }) }).catch(() => {});
    load();
  }

  const blocks: WeekBlock[] = appts.filter((a) => !["cancelled", "no_show"].includes(a.status) && (!filter || a.member_id === filter)).map((a) => ({
    id: a.id,
    date: localDate(Date.parse(a.starts_at), biz.timezone),
    memberId: a.member_id,
    memberName: a.member?.display_name ?? "Barbero",
    title: a.client?.full_name ?? a.items?.map((i: { name: string }) => i.name).join(", ") ?? "Cita",
    startMin: minutesIn(a.starts_at, biz.timezone),
    endMin: minutesIn(a.ends_at, biz.timezone),
  }));
  const shown = appts.filter((a) => localDate(Date.parse(a.starts_at), biz.timezone) === day && (!filter || a.member_id === filter));
  const gridDays = days.map((d) => ({ date: d, dow: DOW[weekdayOf(d)], num: d.slice(8) }));

  return (
    <main>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Semana</div>
          <h1 className="display text-4xl">Agenda</h1>
        </div>
        <div className="flex gap-1">
          <button aria-label="Semana anterior" className="btn2 h-10 w-10 p-0" onClick={() => setDay(addDays(start, -7))}><ChevronLeft className="h-4 w-4" /></button>
          <button aria-label="Semana siguiente" className="btn2 h-10 w-10 p-0" onClick={() => setDay(addDays(start, 7))}><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      {role !== "barber" && <div className="mb-3 flex gap-2 overflow-x-auto">
        <button className={`chip ${!filter ? "chip-on" : ""}`} onClick={() => setFilter("")}>Todos</button>
        {members.map((m) => <button key={m.id} className={`chip whitespace-nowrap ${filter === m.id ? "chip-on" : ""}`} onClick={() => setFilter(m.id)}>{m.display_name}</button>)}
      </div>}
      <WeekGrid days={gridDays} blocks={blocks} active={day} onDay={setDay} onBlock={(id) => {
        const a = appts.find((x) => x.id === id);
        if (a) setDay(localDate(Date.parse(a.starts_at), biz.timezone));
        document.getElementById("dia")?.scrollIntoView({ behavior: "smooth" });
      }} />
      <button className="btn mt-4 w-full" onClick={() => setForm(!form)}>{form ? "Cerrar" : <><Plus className="h-4 w-4" />Nueva cita</>}</button>
      {form && <form onSubmit={create} className="card mt-3 space-y-2">
        {role !== "barber" && <select className="inp" required value={f.member} onChange={(e) => setF({ ...f, member: e.target.value })}><option value="">Barbero…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select>}
        <select className="inp" required value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}><option value="">Servicio…</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_min} min · {formatMoney(s.price, biz.currency)}</option>)}</select>
        <input className="inp" type="time" step={600} required value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        <input className="inp" placeholder="Nombre del cliente" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="inp" placeholder="WhatsApp del cliente" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <button className="btn w-full">Guardar cita</button>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>}
      <h2 id="dia" className="mb-2 mt-6 font-display text-2xl font-extrabold uppercase first-letter:uppercase">{new Date(day + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</h2>
      <ul className="space-y-3">{shown.map((a) => (
        <li key={a.id} id={`cita-${a.id}`} className={`card ${["cancelled", "no_show"].includes(a.status) ? "opacity-60" : ""}`}>
          <div className="flex items-start gap-3">
            <div className="w-14 shrink-0 font-display text-xl font-extrabold tabular-nums">{localTime(Date.parse(a.starts_at), biz.timezone)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{a.client?.full_name ?? "Sin cliente"}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ST[a.status]?.[1] ?? ""}`}>{ST[a.status]?.[0] ?? a.status}</span>
                {paid.has(a.id) && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">Pagada</span>}</div>
              <div className="text-sm">{a.items?.map((i: { name: string }) => i.name).join(", ")}</div>
              <div className="mt-1 text-xs text-ink/50">{a.member?.display_name}{a.source === "booking_link" && <span className="ml-2 inline-flex items-center gap-1"><Globe2 className="h-3 w-3" />reservó online</span>}</div>
            </div>
          </div>
          {!["cancelled", "no_show"].includes(a.status) && <div className="mt-3 flex flex-wrap gap-2 border-t border-black/5 pt-3">
            {!paid.has(a.id) && <Link className="btn py-2 text-sm" href={`/app/cobro?cita=${a.id}`}>Cobrar</Link>}
            {a.status === "reserved" && <button className="btn2" onClick={() => setStatus(a, "confirmed")}>Confirmar</button>}
            {a.status !== "completed" && <button className="btn2" onClick={() => setStatus(a, "no_show")}>No asistió</button>}
            {a.status !== "completed" && <button className="btn2" onClick={() => setStatus(a, "cancelled")}>Cancelar</button>}
          </div>}
        </li>
      ))}</ul>
      {!shown.length && <p className="mt-3 text-sm text-ink/50">No hay citas este día.</p>}
    </main>
  );
}
