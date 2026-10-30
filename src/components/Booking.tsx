"use client";
import { useEffect, useMemo, useState } from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { sb, errEs } from "@/lib/supabase";
import { formatMoney } from "@/lib/money";
import { addDays, localDate, localTime, localToUtcMs, weekdayOf } from "@/lib/time";
import { MapPin, Clock, ChevronLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import type { Catalog, CatalogBarber } from "@/lib/catalog";

export type { Catalog, CatalogBarber, CatalogService } from "@/lib/catalog";

const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function Booking({ slug, barberSlug, previewCatalog, initialStep = 0, preset }: {
  slug: string; barberSlug?: string; previewCatalog?: Catalog; initialStep?: number;
  preset?: { memberId?: string; serviceIds?: string[]; pickFirstSlot?: boolean };
}) {
  const reduce = useReducedMotion();
  const [cat, setCat] = useState<Catalog | null>(previewCatalog ?? null);
  const [err, setErr] = useState("");
  const [date, setDate] = useState("");
  const [member, setMember] = useState<string | null>(null);
  const [svc, setSvc] = useState<string[]>([]);
  const [slots, setSlots] = useState<{ slot_start: string; member_id: string; member_name: string }[] | null>(null);
  const [slot, setSlot] = useState<{ slot_start: string; member_id: string; member_name: string } | null>(null);
  const [step, setStep] = useState(initialStep);
  const [catFilter, setCatFilter] = useState<string>("");
  const [form, setForm] = useState({ name: "", phone: "", optIn: true });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const preview = Boolean(previewCatalog);

  useEffect(() => {
    if (previewCatalog) {
      const today = localDate(Date.now(), previewCatalog.business.timezone);
      setDate(today);
      if (preset?.memberId) setMember(preset.memberId);
      else if (barberSlug) {
        const b = previewCatalog.barbers.find((x) => x.slug === barberSlug);
        if (b) setMember(b.id);
      }
      if (preset?.serviceIds) setSvc(preset.serviceIds);
      return;
    }
    (async () => {
      const { data, error } = await sb().rpc("public_get_catalog", { p_slug: slug });
      if (error || !data) return setErr("No encontramos esta barbería.");
      setCat(data as Catalog);
      setDate(localDate(Date.now(), data.business.timezone));
      if (preset?.memberId) setMember(preset.memberId);
      else if (barberSlug) {
        const b = (data.barbers as CatalogBarber[]).find((x) => x.slug === barberSlug);
        if (!b) setErr("No encontramos este barbero."); else setMember(b.id);
      }
      if (preset?.serviceIds) setSvc(preset.serviceIds);
    })();
  }, [slug, barberSlug, previewCatalog]);

  const tz = cat?.business.timezone ?? "America/Guayaquil";
  const cur = cat?.business.currency ?? "USD";
  const days = useMemo(() => cat ? Array.from({ length: Math.min(cat.business.max_advance_days, 21) }, (_, i) => addDays(localDate(Date.now(), tz), i)) : [], [cat, tz]);
  const barbers = (cat?.barbers ?? []).filter((b) => !date || (b.weekdays ?? []).map(Number).includes(weekdayOf(date)));
  const bObj = cat?.barbers.find((b) => b.id === member);
  const services = (cat?.services ?? []).filter((s) => !bObj || bObj.services.some((x) => x.service_id === s.id)).map((s) => {
    const o = bObj?.services.find((x) => x.service_id === s.id);
    return o ? { ...s, price: o.price, duration_min: o.duration_min } : s;
  });
  const categories = [...new Set(services.map((s) => s.category).filter(Boolean))] as string[];
  const shown = catFilter ? services.filter((s) => s.category === catFilter) : services;
  const steps = barberSlug ? (["fecha", "servicio", "horario", "datos"] as const) : (["fecha", "barbero", "servicio", "horario", "datos"] as const);
  const current = steps[Math.min(step, steps.length - 1)];

  useEffect(() => {
    if (!preset?.pickFirstSlot) setSlot(null);
    if (!date || !member || !svc.length) { setSlots(null); return; }
    if (preview) {
      const name = bObj?.name ?? "";
      const list: { slot_start: string; member_id: string; member_name: string }[] = [];
      for (let h = 9; h <= 19; h++) {
        const hh = String(h).padStart(2, "0");
        list.push({ slot_start: new Date(localToUtcMs(date, `${hh}:00`, tz)).toISOString(), member_id: member, member_name: name });
        if (h < 19) list.push({ slot_start: new Date(localToUtcMs(date, `${hh}:30`, tz)).toISOString(), member_id: member, member_name: name });
      }
      setSlots(list);
      return;
    }
    sb().rpc("public_get_availability", { p_slug: slug, p_member: member, p_service_ids: svc, p_date: date }).then(({ data, error }) => {
      if (error) setErr(errEs(error));
      setSlots(data ?? []);
    });
  }, [date, member, svc.join(",")]);

  useEffect(() => {
    if (preset?.pickFirstSlot && slots?.length) setSlot((cur) => cur ?? slots[0]);
  }, [slots, preset?.pickFirstSlot]);

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return;
    if (preview) { setDone(true); return; }
    setBusy(true); setErr("");
    const { data, error } = await sb().rpc("public_create_booking", { p_slug: slug, p_member: slot.member_id, p_service_ids: svc, p_starts_at: slot.slot_start, p_name: form.name, p_phone: form.phone, p_opt_in: form.optIn, p_notes: null });
    setBusy(false);
    if (error) return setErr(errEs(error));
    // Confirmación por WhatsApp al instante (el cron la manda igual si esto falla).
    await fetch("/api/messages/kick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appointmentId: data.appointment_id }), keepalive: true }).catch(() => {});
    location.href = `/${slug}/cita/${data.manage_token}`;
  }

  if (err && !cat) return <main className="grid min-h-screen place-items-center bg-ink p-6 text-center text-white"><p className="display text-4xl">{err}</p></main>;
  if (!cat || !date) return <main className="grid min-h-screen place-items-center bg-ink text-white"><p className="display text-3xl">Abriendo la agenda…</p></main>;

  const total = services.filter((s) => svc.includes(s.id)).reduce((a, s) => a + Number(s.price), 0);
  const canNext = current === "fecha" ? Boolean(date) : current === "barbero" ? Boolean(member) : current === "servicio" ? svc.length > 0 : current === "horario" ? Boolean(slot) : true;

  function next() {
    if (current === "servicio" && member && svc.length) setStep(step + 1);
    else setStep(Math.min(steps.length - 1, step + 1));
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <main className="paper-blue min-h-screen pb-[calc(2.5rem+var(--sab))] text-white">
        <header className="mx-auto flex max-w-lg items-center justify-between px-4 pb-2 pt-[calc(1rem+var(--sat))]">
          <button aria-label="Atrás" className="grid h-10 w-10 place-items-center rounded-full bg-white/15" onClick={() => step === 0 ? history.back() : setStep(step - 1)}><ChevronLeft /></button>
          <Logo light className="text-xl" />
          <span className="text-xs font-extrabold">{step + 1}/{steps.length}</span>
        </header>
        <div className="mx-auto max-w-lg px-4">
          {cat.business.cover_url && <img src={cat.business.cover_url} alt="" className="mb-4 h-36 w-full rounded-3xl object-cover" />}
          <div className="eyebrow text-[#D6FF4A]">Reserva</div>
          <h1 className="display text-5xl">{cat.business.name}</h1>
          {cat.business.address && <p className="mt-2 flex items-start gap-1.5 text-sm text-white/75"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{cat.business.address}</p>}
          <div className="mt-4 flex gap-1">{steps.map((s, i) => <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-[#D6FF4A]" : "bg-white/25"}`} />)}</div>

          <m.section key={current} className="mt-6 rounded-[1.7rem] bg-[#F4F1E8] p-4 text-ink" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="display mb-3 text-3xl">{current === "fecha" ? "Fecha" : current === "barbero" ? "Barbero" : current === "servicio" ? "Servicio" : current === "horario" ? "Horario" : "Tus datos"}</h2>

            {current === "fecha" && <div className="flex gap-2 hscroll pb-1">{days.map((d) => (
              <button key={d} className={`flex h-20 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border ${d === date ? "border-ink bg-ink text-white" : "border-black/10 bg-white"}`} onClick={() => { setDate(d); if (!barberSlug) setMember(null); setSvc([]); }}>
                <span className="text-[10px] font-bold uppercase">{DAYS[weekdayOf(d)]}</span>
                <span className="font-display text-2xl font-extrabold">{d.slice(8)}</span>
                <span className="text-[10px] uppercase">{MONTHS[Number(d.slice(5, 7)) - 1]}</span>
              </button>
            ))}</div>}

            {current === "barbero" && <div className="grid grid-cols-2 gap-2">{barbers.map((b) => (
              <button key={b.id} className={`rounded-2xl border p-3 text-left font-bold ${member === b.id ? "border-[#2F5BFF] bg-[#2F5BFF] text-white" : "border-black/10 bg-white"}`} onClick={() => { setMember(b.id); setSvc([]); }}>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#D6FF4A] text-sm text-ink">{b.name.slice(0, 1)}</span>
                <span className="mt-2 block">{b.name}</span>
              </button>
            ))}
              {!barbers.length && <p className="col-span-2 text-sm text-ink/60">Nadie trabaja este día. Elige otra fecha.</p>}
            </div>}

            {current === "servicio" && <>
              {categories.length > 1 && <div className="mb-3 flex gap-2 hscroll">{["", ...categories].map((c) => (
                <button key={c || "todas"} className={`pill shrink-0 ${catFilter === c ? "bg-ink text-white" : "bg-white"}`} onClick={() => setCatFilter(c)}>{c || "Todos"}</button>
              ))}</div>}
              <div className="space-y-2">{shown.map((s) => {
                const on = svc.includes(s.id);
                const price = s.price_kind === "from" ? `A partir de ${formatMoney(Number(s.price), cur)}` : formatMoney(Number(s.price), cur);
                return (
                  <button key={s.id} type="button" onClick={() => setSvc(on ? svc.filter((x) => x !== s.id) : [...svc, s.id])} className={`w-full rounded-2xl border p-3 text-left ${on ? "border-[#2F5BFF] bg-white shadow" : "border-black/10 bg-white/70"}`}>
                    <span className="flex items-start justify-between gap-3">
                      <span><span className="block font-bold">{s.name}</span>{s.description && <span className="mt-1 line-clamp-3 block text-xs text-ink/60">{s.description}</span>}<span className="mt-1 flex items-center gap-1 text-xs text-ink/50"><Clock className="h-3 w-3" />{s.duration_min} min</span></span>
                      <span className="whitespace-nowrap text-sm font-extrabold">{price}</span>
                    </span>
                  </button>
                );
              })}</div>
              {svc.length > 0 && <p className="mt-3 text-sm font-bold">Total {formatMoney(total, cur)}</p>}
            </>}

            {current === "horario" && <div className="grid grid-cols-3 gap-2">
              {(slots ?? []).map((s) => (
                <button key={s.slot_start} className={`rounded-xl py-3 text-sm font-extrabold tabular-nums ${slot?.slot_start === s.slot_start ? "bg-ink text-white" : "bg-white"}`} onClick={() => setSlot(s)}>{localTime(new Date(s.slot_start).getTime(), tz)}</button>
              ))}
              {slots && !slots.length && <p className="col-span-3 text-sm text-ink/60">No hay horarios libres. Prueba otro día.</p>}
              {!slots && <p className="col-span-3 text-sm text-ink/50">Buscando horarios…</p>}
            </div>}

            {current === "datos" && !done && slot && <form onSubmit={book} className="space-y-3">
              <p className="text-sm">con <b>{slot.member_name}</b> · {new Date(date + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })} · {localTime(new Date(slot.slot_start).getTime(), tz)}</p>
              <p className="font-display text-3xl font-extrabold">{formatMoney(total, cur)}</p>
              <input className="inp" required placeholder="Tu nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="inp" required type="tel" placeholder="Tu WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-[#2F5BFF]" checked={form.optIn} onChange={(e) => setForm({ ...form, optIn: e.target.checked })} /> Acepto recordatorios por WhatsApp</label>
              <button className="btn w-full" disabled={busy}>{busy ? "Reservando…" : "Confirmar reserva"}</button>
            </form>}
            {done && <p className="font-semibold">Listo. En la barbería real esta reserva queda guardada y te llevamos al enlace para cancelarla.</p>}
          </m.section>

          {current !== "datos" && <button className="btn-gold mt-4 w-full" disabled={!canNext} onClick={next}>Continuar</button>}
          {err && <p className="mt-3 text-sm text-red-200">{err}</p>}
        </div>
      </main>
    </LazyMotion>
  );
}
