"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { sb, errEs } from "@/lib/supabase";
import { formatMoney } from "@/lib/money";
import { addDays, localDate, localTime, weekdayOf } from "@/lib/time";
import { Avatar } from "@/components/ui/avatar";
import { MapPin, Clock, Check, Scissors, CalendarX2 } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <m.section
      className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease }}
    >
      <h2 className="mb-3 flex items-center gap-3 font-display text-lg font-semibold"><span className={`grid h-7 w-7 place-items-center rounded-full font-sans text-sm transition ${done ? "bg-gold text-ink" : "bg-ink text-cream"}`}>{done ? <Check className="h-4 w-4" /> : n}</span>{title}</h2>
      {children}
    </m.section>
  );
}

const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
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
  if (err && !cat) return <main className="grid min-h-screen place-items-center bg-ink p-6 text-center text-cream"><div><CalendarX2 className="mx-auto mb-3 h-10 w-10 text-gold" /><p className="font-display text-2xl">{err}</p></div></main>;
  if (!cat) return <main className="grid min-h-screen place-items-center bg-ink text-cream"><div className="flex flex-col items-center gap-3"><Scissors className="h-7 w-7 animate-pulse text-gold" /><p className="font-display text-lg">Abriendo la agenda…</p></div></main>;
  const total = services.filter((s: any) => svc.includes(s.id)).reduce((a: number, s: any) => a + Number(s.price), 0);
  const stepB = barberSlug ? 0 : 1;
  const progress = [Boolean(date), Boolean(barberSlug || member), svc.length > 0, Boolean(slot)].filter(Boolean).length;
  return (
    <LazyMotion features={domAnimation} strict>
    <main className="min-h-screen bg-background pb-16">
      <header className="grain relative overflow-hidden bg-ink text-cream">
        <Image src="/img/chair.jpg" alt="" fill priority className="object-cover opacity-35" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/75 to-ink/35" />
        <div className="relative mx-auto max-w-xl px-5 pb-10 pt-14">
          <div className="eyebrow text-gold">Reserva online</div>
          <h1 className="mt-2 font-display text-4xl font-semibold md:text-5xl">{cat.business.name}</h1>
          {cat.business.address && <p className="mt-2 flex items-center gap-1.5 text-sm text-cream/70"><MapPin className="h-4 w-4 text-gold" />{cat.business.address}</p>}
          {barberSlug && bObj && <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur"><Avatar name={bObj.name} src={bObj.photo_url} size={48} /><div><div className="text-xs text-cream/60">Tu barbero</div><p className="font-display text-lg">Con <b>{bObj.name}</b></p></div></div>}
          <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={4} aria-label="Progreso de la reserva">
            <div className="h-full rounded-full bg-gold transition-all duration-500" style={{ width: `${(progress / 4) * 100}%` }} />
          </div>
        </div>
      </header>
      <div className="mx-auto -mt-5 max-w-xl space-y-4 px-4">
      <Step n={1} title="Fecha" done={!!date}><div className="relative"><div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">{days.map((d) => (
        <m.button key={d} whileTap={{ scale: 0.96 }} className={`flex h-[4.5rem] w-14 shrink-0 flex-col items-center justify-center rounded-xl border transition ${d === date ? "border-ink bg-ink text-cream shadow-md" : "border-border bg-card hover:border-gold"}`} onClick={() => { setDate(d); if (!barberSlug) setMember(null); }}>
          <span className="text-[11px] uppercase opacity-70">{DAYS[weekdayOf(d)]}</span><span className="font-display text-xl font-semibold">{d.slice(8)}</span><span className="text-[10px] opacity-60">{MONTHS[Number(d.slice(5, 7)) - 1]}</span></m.button>))}</div><div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent" /></div></Step>
      {!barberSlug && <Step n={2} title="Barbero" done={!!member}><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{barbers.map((b: any) => (
        <m.button key={b.id} whileTap={{ scale: 0.97 }} className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${member === b.id ? "border-gold bg-gold/10 ring-2 ring-gold" : "border-border hover:border-gold"}`} onClick={() => { setMember(b.id); setSvc([]); }}>
          <Avatar name={b.name} src={b.photo_url} size={56} /><span className="text-sm font-medium">{b.name}</span></m.button>))}
        {!barbers.length && <p className="col-span-full text-sm text-muted-foreground">Nadie trabaja este día. Prueba otra fecha.</p>}</div></Step>}
      {member && <Step n={2 + stepB} title="Servicio" done={svc.length > 0}><div className="space-y-2">{services.map((s: any) => (
        <label key={s.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition active:scale-[.99] ${svc.includes(s.id) ? "border-gold bg-gold/10 shadow-sm" : "border-border hover:border-gold"}`}>
          <span className="flex items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-[#c9a35c]" checked={svc.includes(s.id)} onChange={(e) => setSvc(e.target.checked ? [...svc, s.id] : svc.filter((x) => x !== s.id))} /><span><span className="block font-medium">{s.name}</span><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{s.duration_min} min</span></span></span>
          <span className="font-display text-lg font-semibold">{formatMoney(Number(s.price), cur)}</span></label>))}</div></Step>}
      {slots && <Step n={3 + stepB} title="Horario" done={!!slot}><div className="grid grid-cols-4 gap-2">{slots.map((s) => (
        <m.button key={s.slot_start} whileHover={{ y: -2 }} whileTap={{ scale: 0.94 }} className={`min-h-11 rounded-lg border py-2.5 text-sm font-medium tabular-nums transition ${slot?.slot_start === s.slot_start ? "border-ink bg-ink text-cream shadow-md" : "border-border bg-card hover:border-gold"}`} onClick={() => setSlot(s)}>{localTime(new Date(s.slot_start).getTime(), tz)}</m.button>))}</div>
        {!slots.length && <p className="text-sm text-muted-foreground">No hay horarios libres. Prueba otro día.</p>}</Step>}
      {slot && <m.form onSubmit={book} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 rounded-2xl bg-ink p-5 text-cream shadow-[0_20px_50px_rgba(14,12,10,.25)]">
        <div className="eyebrow text-gold">Resumen</div>
        <p className="font-display text-xl capitalize">{new Date(date + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })} · {localTime(new Date(slot.slot_start).getTime(), tz)}</p>
        <p className="text-sm text-cream/70">con {slot.member_name} · Total <b className="text-gold-300">{formatMoney(total, cur)}</b></p>
        <input className="inp text-ink" required placeholder="Tu nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="inp text-ink" required type="tel" placeholder="Tu WhatsApp / celular" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <label className="flex items-center gap-2 text-sm text-cream/80"><input type="checkbox" className="h-5 w-5 accent-[#c9a35c]" checked={form.optIn} onChange={(e) => setForm({ ...form, optIn: e.target.checked })} /> Acepto recibir recordatorios por WhatsApp</label>
        <button className="btn-gold w-full" disabled={busy}>{busy ? "Reservando…" : "Confirmar reserva"}</button></m.form>}
      {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </main>
    </LazyMotion>
  );
}
