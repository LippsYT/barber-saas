"use client";
import { useEffect, useMemo, useState } from "react";
import { sb, errEs } from "@/lib/supabase";
import { formatMoney } from "@/lib/money";
import { addDays, localDate, localTime, weekdayOf } from "@/lib/time";

const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export function Booking({ slug, barberSlug }: { slug: string; barberSlug?: string }) {
  const [cat, setCat] = useState<any>(null); const [err, setErr] = useState("");
  const [date, setDate] = useState(""); const [member, setMember] = useState<string | null>(null); const [svc, setSvc] = useState<string[]>([]);
  const [slots, setSlots] = useState<any[] | null>(null); const [slot, setSlot] = useState<any>(null);
  const [form, setForm] = useState({ name: "", phone: "", optIn: true }); const [busy, setBusy] = useState(false);
  useEffect(() => { (async () => {
    const { data, error } = await sb().rpc("public_get_catalog", { p_slug: slug });
    if (error || !data) return setErr("No encontramos esta barbería.");
    setCat(data); const today = localDate(Date.now(), data.business.timezone); setDate(today);
    if (barberSlug) { const b = data.barbers.find((x: any) => x.slug === barberSlug); if (!b) setErr("No encontramos este barbero."); else setMember(b.id); }
  })(); }, [slug, barberSlug]);
  const tz = cat?.business.timezone; const cur = cat?.business.currency;
  const days = useMemo(() => cat ? Array.from({ length: Math.min(cat.business.max_advance_days, 30) }, (_, i) => addDays(localDate(Date.now(), tz), i)) : [], [cat]);
  const barbers = (cat?.barbers ?? []).filter((b: any) => !date || b.weekdays.includes(weekdayOf(date)));
  const bObj = cat?.barbers.find((b: any) => b.id === member);
  const services = (cat?.services ?? []).filter((s: any) => !bObj || bObj.services.some((x: any) => x.service_id === s.id)).map((s: any) => { const o = bObj?.services.find((x: any) => x.service_id === s.id); return o ? { ...s, price: o.price, duration_min: o.duration_min } : s; });
  useEffect(() => { setSlot(null); setSlots(null); if (!date || !member || !svc.length) return;
    sb().rpc("public_get_availability", { p_slug: slug, p_member: member, p_service_ids: svc, p_date: date }).then(({ data, error }) => { if (error) setErr(errEs(error)); setSlots(data ?? []); });
  }, [date, member, svc.join(",")]);
  async function book(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const { data, error } = await sb().rpc("public_create_booking", { p_slug: slug, p_member: slot.member_id, p_service_ids: svc, p_starts_at: slot.slot_start, p_name: form.name, p_phone: form.phone, p_opt_in: form.optIn, p_notes: null });
    setBusy(false); if (error) return setErr(errEs(error));
    location.href = `/b/${slug}/cita/${data.manage_token}`;
  }
  if (err && !cat) return <main className="p-6">{err}</main>;
  if (!cat) return <main className="p-6">Cargando…</main>;
  const total = services.filter((s: any) => svc.includes(s.id)).reduce((a: number, s: any) => a + Number(s.price), 0);
  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <div><h1 className="h1">{cat.business.name}</h1>{cat.business.address && <p className="text-sm text-gray-500">{cat.business.address}</p>}</div>
      <section><div className="lbl">1. Fecha</div><div className="flex gap-2 overflow-x-auto pb-1">{days.map((d) => (
        <button key={d} className={`chip shrink-0 ${d === date ? "chip-on" : "bg-white"}`} onClick={() => { setDate(d); if (!barberSlug) setMember(null); }}>{DAYS[weekdayOf(d)]} {d.slice(8)}</button>))}</div></section>
      {!barberSlug && <section><div className="lbl">2. Barbero</div><div className="flex flex-wrap gap-2">{barbers.map((b: any) => (
        <button key={b.id} className={`chip ${member === b.id ? "chip-on" : "bg-white"}`} onClick={() => { setMember(b.id); setSvc([]); }}>{b.name}</button>))}
        {!barbers.length && <p className="text-sm text-gray-500">Nadie trabaja este día.</p>}</div></section>}
      {barberSlug && bObj && <p>Con <b>{bObj.name}</b></p>}
      {member && <section><div className="lbl">3. Servicio</div><div className="space-y-2">{services.map((s: any) => (
        <label key={s.id} className={`card flex items-center justify-between ${svc.includes(s.id) ? "ring-2 ring-black" : ""}`}>
          <span><input type="checkbox" className="mr-2" checked={svc.includes(s.id)} onChange={(e) => setSvc(e.target.checked ? [...svc, s.id] : svc.filter((x) => x !== s.id))} />{s.name} · {s.duration_min} min</span><span>{formatMoney(Number(s.price), cur)}</span></label>))}</div></section>}
      {slots && <section><div className="lbl">4. Horario</div><div className="grid grid-cols-4 gap-2">{slots.map((s) => (
        <button key={s.slot_start} className={`chip ${slot?.slot_start === s.slot_start ? "chip-on" : "bg-white"}`} onClick={() => setSlot(s)}>{localTime(new Date(s.slot_start).getTime(), tz)}</button>))}</div>
        {!slots.length && <p className="text-sm text-gray-500">No hay horarios libres. Prueba otro día.</p>}</section>}
      {slot && <form onSubmit={book} className="card space-y-2">
        <p className="text-sm">{date} a las {localTime(new Date(slot.slot_start).getTime(), tz)} con {slot.member_name} · Total {formatMoney(total, cur)}</p>
        <input className="inp" required placeholder="Tu nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="inp" required type="tel" placeholder="Tu WhatsApp / celular" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <label className="text-sm"><input type="checkbox" checked={form.optIn} onChange={(e) => setForm({ ...form, optIn: e.target.checked })} /> Acepto recibir recordatorios por WhatsApp</label>
        <button className="btn w-full" disabled={busy}>{busy ? "Reservando…" : "Confirmar reserva"}</button></form>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </main>
  );
}
