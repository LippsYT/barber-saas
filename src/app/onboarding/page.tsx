"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, ChevronLeft, Minus, Plus, X } from "lucide-react";
import { isReservedSlug } from "@/lib/reserved";
import { sb, errEs } from "@/lib/supabase";
import { emptyServiceDraft } from "@/components/app/ServiceEditor";
import { WhatsAppConnect } from "@/components/app/WhatsAppConnect";
import { saveServiceBundle } from "@/lib/saveService";
import { Logo } from "@/components/brand/Logo";

const TZ = [["America/Guayaquil", "Ecuador", "USD"], ["America/Bogota", "Colombia", "COP"], ["America/Argentina/Buenos_Aires", "Argentina", "ARS"], ["America/Mexico_City", "México", "MXN"], ["America/Santiago", "Chile", "CLP"], ["America/Lima", "Perú", "PEN"], ["America/New_York", "EE. UU. (Este)", "USD"]] as const;
const STEPS = ["Tu barbería", "Logotipo", "Equipo", "Servicios", "Horario", "Contacto", "WhatsApp", "Listo"] as const;
const TIPS: { text: string }[] = [
  { text: "¡Hola! Te dejo todo listo en unos minutos. Empecemos por el nombre." },
  { text: "Tu logo sale en tu página de reservas. Si no lo tienes ahora, lo subes después." },
  { text: "Cuéntame cuántos barberos atienden. Con su correo cada uno tendrá su propio usuario." },
  { text: "Elige los servicios que ofreces. Los precios son de ejemplo: cámbialos a los tuyos." },
  { text: "Dime cuándo abres. Tus clientes solo podrán reservar en estas horas." },
  { text: "Este será tu enlace de reservas. Lo compartirás en Instagram y WhatsApp." },
  { text: "Conecta tu WhatsApp para confirmar y recordar citas solo. Puedes hacerlo después." },
  { text: "¡Todo listo! Tu barbería ya puede recibir reservas." },
];

/** Servicios de ejemplo para elegir con un toque. Los precios de ejemplo son en dólares: en otra moneda se dejan vacíos para que pongan los suyos. */
const QUICK = [
  { key: "corte", name: "Corte clásico", price: "8", duration: 30 },
  { key: "barba", name: "Barba", price: "5", duration: 20 },
  { key: "combo", name: "Corte + barba", price: "12", duration: 45 },
  { key: "nino", name: "Corte niño", price: "6", duration: 30 },
  { key: "cejas", name: "Cejas", price: "3", duration: 15 },
  { key: "tinte", name: "Tinte", price: "20", duration: 60 },
] as const;
const DAYS: [string, number][] = [["Lun", 1], ["Mar", 2], ["Mié", 3], ["Jue", 4], ["Vie", 5], ["Sáb", 6], ["Dom", 0]];
/** De 05:00 a 23:30, cada 30 minutos. */
const HOURS = Array.from({ length: 38 }, (_, i) => { const m = 5 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`; });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validPrice = (p: string) => p.trim() !== "" && Number(p.replace(",", ".")) >= 0;

type Biz = { id: string; slug: string; name: string };
type Member = { id: string; name: string };

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [biz, setBiz] = useState<Biz | null>(null);
  const [trialDays, setTrialDays] = useState<number | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Paso 1: nombre
  const [shop, setShop] = useState(""); const [me, setMe] = useState(""); const [tz, setTz] = useState(0); const [bookable, setBookable] = useState(true);
  // Paso 2: logo
  const [logoUrl, setLogoUrl] = useState(""); const [logoBusy, setLogoBusy] = useState(false);
  // Paso 3: equipo
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(1);
  const [others, setOthers] = useState<{ name: string; email: string }[]>([]);
  // Paso 4: servicios
  const [existing, setExisting] = useState<string[]>([]);
  const [picked, setPicked] = useState<Record<string, { on: boolean; price: string }>>(() => Object.fromEntries(QUICK.map((q) => [q.key, { on: q.key === "corte" || q.key === "barba", price: q.price }])));
  const [custom, setCustom] = useState<{ name: string; price: string; duration: number }[]>([]);
  // Paso 5: horario
  const [openDays, setOpenDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [from, setFrom] = useState("09:00"); const [to, setTo] = useState("19:00");
  // Paso 6: contacto
  const [phone, setPhone] = useState(""); const [address, setAddress] = useState(""); const [slug, setSlug] = useState("");
  const [copied, setCopied] = useState(false);

  const daysLeft = (iso: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5)) : null);

  useEffect(() => { (async () => {
    const { data: u } = await sb().auth.getUser();
    if (!u.user) return router.replace("/login");
    const { data, error } = await sb().from("memberships").select("display_name, business:businesses(id,name,slug,phone,address,logo_url,trial_ends_at)").eq("user_id", u.user.id).eq("active", true).limit(1);
    // Si la consulta falla (p. ej. falta la migración 0034) no se asume que no hay negocio: se evitaría crear uno repetido.
    if (error) { setLoadError(errEs(error)); setReady(true); return; }
    const m = data?.[0] as unknown as { display_name: string | null; business: (Biz & { phone: string | null; address: string | null; logo_url: string | null; trial_ends_at: string | null }) | null } | undefined;
    if (m?.business) {
      const b = m.business;
      setBiz({ id: b.id, slug: b.slug, name: b.name }); setShop(b.name); setMe(m.display_name ?? ""); setSlug(b.slug);
      setPhone(b.phone ?? ""); setAddress(b.address ?? ""); setLogoUrl(b.logo_url ?? ""); setTrialDays(daysLeft(b.trial_ends_at));
      const team = await refreshTeam(b.id);
      setTotal(Math.max(1, team.length));
      setStep(1);
    }
    setReady(true);
  })(); }, [router]);

  async function refreshTeam(id: string): Promise<Member[]> {
    const [{ data: mem }, { data: svc }] = await Promise.all([
      sb().from("memberships").select("id, display_name").eq("business_id", id).eq("active", true).eq("is_bookable", true).order("display_name"),
      sb().from("services").select("name").eq("business_id", id).eq("active", true),
    ]);
    const list = (mem ?? []).map((x: { id: string; display_name: string }) => ({ id: x.id, name: x.display_name }));
    setMembers(list); setExisting((svc ?? []).map((s: { name: string }) => s.name.trim().toLowerCase()));
    return list;
  }

  const fail = (m: string) => { setBusy(false); setErr(m); };
  const go = (n: number) => { setErr(""); setStep(n); };

  // ——— Paso 1: crea el negocio (o, si ya existe, corrige el nombre)
  async function saveName(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    if (biz) {
      const { error } = await sb().from("businesses").update({ name: shop.trim() }).eq("id", biz.id);
      if (error) return fail(errEs(error));
      setBiz({ ...biz, name: shop.trim() }); setBusy(false); return go(1);
    }
    const { data, error } = await sb().rpc("create_business", { p_name: shop, p_slug: "", p_display_name: me, p_timezone: TZ[tz][0], p_currency: TZ[tz][2], p_owner_bookable: bookable });
    if (error) return fail(errEs(error));
    const { data: row } = await sb().from("businesses").select("id, slug, name, trial_ends_at").eq("id", data).single();
    const b = row as unknown as Biz & { trial_ends_at: string | null };
    setBiz({ id: b.id, slug: b.slug, name: b.name }); setSlug(b.slug); setTrialDays(daysLeft(b.trial_ends_at));
    const team = await refreshTeam(b.id); setTotal(Math.max(1, team.length));
    setBusy(false); go(1);
  }

  // ——— Paso 2: logo
  async function uploadLogo(file: File) {
    if (!biz) return;
    setErr("");
    if (!file.type.startsWith("image/")) return setErr("Elige una imagen (JPG, PNG o WebP).");
    if (file.size > 4 * 1024 * 1024) return setErr("La imagen pesa demasiado. Usa una de menos de 4 MB.");
    setLogoBusy(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${biz.id}/logo-${crypto.randomUUID()}.${ext}`;
    const up = await sb().storage.from("covers").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setLogoBusy(false); return setErr("No pudimos subir la imagen. Intenta con otra o sigue sin logo por ahora."); }
    const url = sb().storage.from("covers").getPublicUrl(path).data.publicUrl;
    const { error } = await sb().from("businesses").update({ logo_url: url }).eq("id", biz.id);
    setLogoBusy(false);
    if (error) return setErr(errEs(error));
    setLogoUrl(url);
  }
  async function removeLogo() {
    if (!biz) return;
    const { error } = await sb().from("businesses").update({ logo_url: null }).eq("id", biz.id);
    if (error) return setErr(errEs(error));
    setLogoUrl("");
  }

  // ——— Paso 3: equipo
  const newCount = Math.max(0, total - members.length);
  useEffect(() => { setOthers((cur) => Array.from({ length: newCount }, (_, i) => cur[i] ?? { name: "", email: "" })); }, [newCount]);
  async function saveTeam(e: React.FormEvent) {
    e.preventDefault(); if (!biz) return; setErr("");
    for (const o of others) if (o.email.trim() && !EMAIL.test(o.email.trim())) return setErr(`El correo «${o.email}» no es válido.`);
    const fill = others.map((o, i) => ({ name: o.name.trim() || `Barbero ${members.length + i + 1}`, email: o.email.trim().toLowerCase() }));
    setBusy(true);
    for (const o of fill) {
      const { error } = await sb().from("memberships").insert({ business_id: biz.id, display_name: o.name, role: "barber", is_bookable: true, invited_email: o.email || null });
      if (error) return fail(errEs(error));
    }
    await refreshTeam(biz.id); setBusy(false); go(3);
  }

  // ——— Paso 4: servicios
  useEffect(() => {
    const usd = TZ[tz][2] === "USD";
    setPicked((p) => Object.fromEntries(QUICK.map((q) => [q.key, { on: p[q.key]?.on ?? false, price: usd ? q.price : "" }])));
  }, [tz]);
  const chosen = useMemo(() => QUICK.filter((q) => picked[q.key]?.on && !existing.includes(q.name.toLowerCase())), [picked, existing]);
  const customReady = custom.filter((c) => c.name.trim());
  async function saveServices() {
    if (!biz) return; setErr(""); setBusy(true);
    const list = [
      ...chosen.map((q) => ({ name: q.name, price: picked[q.key].price, duration: q.duration })),
      ...customReady.map((c) => ({ name: c.name.trim(), price: c.price, duration: c.duration })),
    ];
    for (const s of list) {
      if (!validPrice(s.price)) return fail(`Pon el precio de «${s.name}».`);
      const draft = { ...emptyServiceDraft(members), name: s.name, price: s.price.replace(",", "."), duration: String(s.duration) };
      const res = await saveServiceBundle(biz.id, null, draft);
      if ("error" in res) return fail(res.error);
    }
    await refreshTeam(biz.id); setCustom([]); setBusy(false); go(4);
  }

  // ——— Paso 5: horario
  async function saveHours() {
    if (!biz) return; setErr("");
    if (!openDays.length) return setErr("Elige al menos un día de atención.");
    if (to <= from) return setErr("La hora de cierre tiene que ser después de la de apertura.");
    setBusy(true);
    const bh = DAYS.map(([, w]) => ({ business_id: biz.id, weekday: w, is_open: openDays.includes(w), start_time: from, end_time: to }));
    const a = await sb().from("business_hours").upsert(bh, { onConflict: "business_id,weekday" });
    if (a.error) return fail(errEs(a.error));
    const ids = members.map((m) => m.id);
    if (ids.length) {
      const d = await sb().from("working_hours").delete().in("member_id", ids);
      if (d.error) return fail(errEs(d.error));
      const rowsWh = ids.flatMap((id) => openDays.map((w) => ({ business_id: biz.id, member_id: id, weekday: w, start_time: from, end_time: to })));
      const i = await sb().from("working_hours").insert(rowsWh);
      if (i.error) return fail(errEs(i.error));
    }
    setBusy(false); go(5);
  }

  // ——— Paso 6: contacto y enlace
  async function saveContact(e: React.FormEvent) {
    e.preventDefault(); if (!biz) return; setErr("");
    const next = slug.trim().toLowerCase() || biz.slug;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(next)) return setErr("El enlace solo puede tener letras minúsculas, números y guiones.");
    if (isReservedSlug(next)) return setErr("Ese enlace está reservado. Elige otro.");
    setBusy(true);
    const { error } = await sb().from("businesses").update({ phone: phone.trim() || null, address: address.trim() || null, slug: next }).eq("id", biz.id);
    if (error) return fail(errEs(error));
    setBiz({ ...biz, slug: next }); setSlug(next); setBusy(false); go(6);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = biz ? `${origin}/${biz.slug}` : "";
  const progress = step / (STEPS.length - 1);

  if (!ready) return <main className="grid min-h-screen place-items-center bg-[#070B14]"><Logo light /></main>;

  if (loadError) return (
    <main className="grid min-h-screen place-items-center bg-[#070B14] px-6 text-center text-white">
      <div className="max-w-sm space-y-4"><Logo light /><p className="text-lg font-bold">No pudimos cargar tu cuenta.</p><p className="text-sm text-white/70">{loadError}</p>
        <button className="btn w-full" onClick={() => location.reload()}>Reintentar</button></div>
    </main>);

  const tip = TIPS[step];
  const card = "rounded-3xl border border-white/10 bg-white/[0.06] p-4";
  const back = () => (step === 0 ? router.push("/") : go(step - 1));

  return (
    <main className="min-h-screen bg-[#070B14] bg-[radial-gradient(120%_50%_at_100%_0%,rgba(47,91,255,.35),transparent_60%)] text-white">
      <div className="mx-auto max-w-lg px-4 pb-[calc(2rem+var(--sab))] pt-[calc(1.25rem+var(--sat))]">
        <div className="mb-5 flex items-center justify-between">
          {step < STEPS.length - 1 ? <button aria-label="Atrás" className="grid h-10 w-10 place-items-center rounded-full bg-white/10" onClick={back}><ChevronLeft /></button> : <span className="h-10 w-10" />}
          <div className="text-sm font-extrabold">{STEPS[step]}</div>
          <div className="w-10 text-right text-xs font-bold text-white/55">{step + 1}/{STEPS.length}</div>
        </div>
        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-white/15"><motion.div className="h-full rounded-full bg-[#D6FF4A]" initial={false} animate={{ width: `${Math.max(6, progress * 100)}%` }} transition={{ type: "spring", stiffness: 140, damping: 22 }} /></div>

        <div className="mb-5 flex items-end gap-3">
          <img src="/mascot/barbero.webp" alt="Chispa, el barbero de Pulso" width={288} height={438} className="pointer-events-none h-auto w-20 shrink-0" />
          <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="relative mb-2 rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-sm font-semibold text-[#070B14]">{tip.text}</motion.div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={{ duration: 0.22 }}>

            {step === 0 && <form onSubmit={saveName} className="space-y-4">
              <h1 className="display text-4xl">¿Cómo se llama tu barbería?</h1>
              <input className="inp text-lg text-ink" required autoFocus placeholder="Ej. Barbería Don Carlos" value={shop} onChange={(e) => setShop(e.target.value)} />
              {!biz && <>
                <label className="lbl text-white/70">Tu nombre<input className="inp mt-1 text-ink" required placeholder="Cómo te llaman tus clientes" value={me} onChange={(e) => setMe(e.target.value)} /></label>
                <div><div className="lbl mb-1 text-white/70">¿En qué país estás?</div>
                  <div className="flex flex-wrap gap-2">{TZ.map((t, i) => <button type="button" key={t[0]} onClick={() => setTz(i)} className={`rounded-full px-3.5 py-2 text-sm font-bold ${tz === i ? "bg-[#D6FF4A] text-[#070B14]" : "bg-white/10 text-white/80"}`}>{t[1]}</button>)}</div></div>
                <label className={`${card} flex cursor-pointer items-center gap-3 text-sm font-semibold`}><input type="checkbox" className="h-5 w-5 accent-[#D6FF4A]" checked={bookable} onChange={(e) => setBookable(e.target.checked)} />Yo también atiendo clientes</label>
              </>}
              <button className="btn w-full" disabled={busy || !shop.trim()}>{busy ? "Creando…" : "Continuar"}</button>
              {err && <p className="text-sm text-[#FFB4C2]">{err}</p>}
            </form>}

            {step === 1 && <div className="space-y-5 text-center">
              <h1 className="display text-4xl">Sube tu logotipo</h1>
              <div className="relative mx-auto h-40 w-40">
                <motion.div key={logoUrl || "none"} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid h-40 w-40 place-items-center overflow-hidden rounded-[2rem] bg-[#2F5BFF] ring-4 ring-white/15">
                  {logoUrl ? <img src={logoUrl} alt="Logotipo" className="h-full w-full object-cover" /> : <span className="font-display text-7xl font-extrabold uppercase text-[#D6FF4A]">{(shop.trim()[0] || "P").toUpperCase()}</span>}
                </motion.div>
                {logoUrl && <button aria-label="Quitar logo" onClick={removeLogo} className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-full bg-white text-[#070B14] shadow"><X className="h-4 w-4" /></button>}
              </div>
              <label className="btn2 mx-auto inline-flex cursor-pointer items-center gap-2 text-ink">
                <Camera className="h-5 w-5" />{logoBusy ? "Subiendo…" : logoUrl ? "Cambiar imagen" : "Elegir imagen"}
                <input type="file" accept="image/*" className="sr-only" disabled={logoBusy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); e.target.value = ""; }} />
              </label>
              <p className="text-xs text-white/55">JPG, PNG o WebP. Se verá en tu página de reservas.</p>
              {err && <p className="text-sm text-[#FFB4C2]">{err}</p>}
              <button className="btn w-full" onClick={() => go(2)}>{logoUrl ? "Continuar" : "Saltar por ahora"}</button>
            </div>}

            {step === 2 && <form onSubmit={saveTeam} className="space-y-4">
              <h1 className="display text-4xl">¿Cuántos barberos atienden?</h1>
              <div className={`${card} flex items-center justify-between`}>
                <button type="button" aria-label="Uno menos" disabled={total <= Math.max(1, members.length)} onClick={() => setTotal(total - 1)} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 disabled:opacity-30"><Minus /></button>
                <div className="text-center"><motion.div key={total} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-6xl font-extrabold leading-none text-[#D6FF4A]">{total}</motion.div><div className="mt-1 text-xs font-bold uppercase tracking-widest text-white/55">{total === 1 ? "barbero" : "barberos"} en total</div></div>
                <button type="button" aria-label="Uno más" disabled={total >= 15} onClick={() => setTotal(total + 1)} className="grid h-12 w-12 place-items-center rounded-full bg-[#D6FF4A] text-[#070B14] disabled:opacity-30"><Plus /></button>
              </div>
              {members.length > 0 && <div className={card}><div className="mb-2 text-xs font-extrabold uppercase tracking-widest text-white/50">Ya en tu equipo</div>
                <ul className="flex flex-wrap gap-2">{members.map((m) => <li key={m.id} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold">{m.name}</li>)}</ul></div>}
              <AnimatePresence initial={false}>{others.map((o, i) => (
                <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className={`${card} space-y-2`}>
                    <div className="text-xs font-extrabold uppercase tracking-widest text-white/50">Barbero {members.length + i + 1}</div>
                    <input className="inp text-ink" placeholder="Nombre" value={o.name} onChange={(e) => setOthers(others.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    <input className="inp text-ink" type="email" inputMode="email" placeholder="Correo (opcional): así tendrá su propio usuario" value={o.email} onChange={(e) => setOthers(others.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                  </div>
                </motion.div>))}</AnimatePresence>
              <p className="text-xs text-white/55">Sin correo, el barbero aparece en la agenda pero no entra a la app. Con correo, cuando se registre con ese mismo correo queda vinculado a su puesto.</p>
              <button className="btn w-full" disabled={busy}>{busy ? "Guardando…" : "Continuar"}</button>
              {err && <p className="text-sm text-[#FFB4C2]">{err}</p>}
            </form>}

            {step === 3 && <div className="space-y-4">
              <h1 className="display text-4xl">Elige tus servicios</h1>
              <div className="space-y-2">{QUICK.map((q) => {
                const done = existing.includes(q.name.toLowerCase()); const p = picked[q.key];
                return (
                  <div key={q.key} className={`flex items-center gap-3 rounded-2xl border p-3 ${p.on || done ? "border-[#D6FF4A]/60 bg-[#D6FF4A]/10" : "border-white/10 bg-white/[0.05]"}`}>
                    <button type="button" aria-pressed={p.on || done} aria-label={q.name} disabled={done} onClick={() => setPicked({ ...picked, [q.key]: { ...p, on: !p.on } })} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${p.on || done ? "bg-[#D6FF4A] text-[#070B14]" : "bg-white/15"}`}>{(p.on || done) && <Check className="h-4 w-4" />}</button>
                    <div className="min-w-0 flex-1"><div className="truncate font-bold">{q.name}</div><div className="text-xs text-white/55">{done ? "Ya creado" : `${q.duration} min`}</div></div>
                    {!done && <label className="flex items-center gap-1 rounded-xl bg-white px-2.5 py-1.5 text-ink"><span className="text-sm font-bold">$</span><input inputMode="decimal" aria-label={`Precio de ${q.name}`} className="w-14 bg-transparent text-right font-bold outline-none" value={p.price} onChange={(e) => setPicked({ ...picked, [q.key]: { on: true, price: e.target.value.replace(/[^0-9.,]/g, "") } })} /></label>}
                  </div>); })}</div>
              {custom.map((c, i) => (
                <div key={i} className={`${card} flex items-center gap-2`}>
                  <input className="inp min-w-0 flex-1 text-ink" placeholder="Nombre del servicio" value={c.name} onChange={(e) => setCustom(custom.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <label className="flex items-center gap-1 rounded-xl bg-white px-2.5 py-2 text-ink"><span className="text-sm font-bold">$</span><input inputMode="decimal" aria-label="Precio" className="w-14 bg-transparent text-right font-bold outline-none" value={c.price} onChange={(e) => setCustom(custom.map((x, j) => j === i ? { ...x, price: e.target.value.replace(/[^0-9.,]/g, "") } : x))} /></label>
                  <button type="button" aria-label="Quitar" onClick={() => setCustom(custom.filter((_, j) => j !== i))} className="p-1 text-white/60"><X className="h-4 w-4" /></button>
                </div>))}
              <button type="button" className="btn2 w-full text-ink" onClick={() => setCustom([...custom, { name: "", price: "", duration: 30 }])}>+ Otro servicio</button>
              <p className="text-xs text-white/55">Los precios son de ejemplo: ajústalos a los tuyos. Después puedes editar duración, descripción y comisiones en Ajustes → Servicios.</p>
              {err && <p className="text-sm text-[#FFB4C2]">{err}</p>}
              <button className="btn w-full" disabled={busy} onClick={saveServices}>{busy ? "Guardando…" : chosen.length + customReady.length ? "Crear servicios y continuar" : "Continuar"}</button>
            </div>}

            {step === 4 && <div className="space-y-4">
              <h1 className="display text-4xl">¿Cuándo atiendes?</h1>
              <div className="flex gap-1.5">{DAYS.map(([label, w]) => { const on = openDays.includes(w); return <button type="button" key={w} aria-pressed={on} onClick={() => setOpenDays(on ? openDays.filter((d) => d !== w) : [...openDays, w])} className={`h-12 flex-1 rounded-2xl text-sm font-extrabold ${on ? "bg-[#D6FF4A] text-[#070B14]" : "bg-white/10 text-white/70"}`}>{label}</button>; })}</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="lbl text-white/70">Abres<select className="inp mt-1 text-ink" value={from} onChange={(e) => setFrom(e.target.value)}>{HOURS.map((h) => <option key={h}>{h}</option>)}</select></label>
                <label className="lbl text-white/70">Cierras<select className="inp mt-1 text-ink" value={to} onChange={(e) => setTo(e.target.value)}>{HOURS.map((h) => <option key={h}>{h}</option>)}</select></label>
              </div>
              <p className="text-xs text-white/55">Se aplica a todo el equipo. Después puedes cambiar el horario de cada barbero y los días especiales en Ajustes → Horario.</p>
              {err && <p className="text-sm text-[#FFB4C2]">{err}</p>}
              <button className="btn w-full" disabled={busy} onClick={saveHours}>{busy ? "Guardando…" : "Continuar"}</button>
            </div>}

            {step === 5 && <form onSubmit={saveContact} className="space-y-4">
              <h1 className="display text-4xl">Tu enlace y contacto</h1>
              <label className="lbl text-white/70">Teléfono del negocio<input className="inp mt-1 text-ink" inputMode="tel" placeholder="+593 99 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
              <label className="lbl text-white/70">Dirección<input className="inp mt-1 text-ink" placeholder="Calle, número y ciudad" value={address} onChange={(e) => setAddress(e.target.value)} /></label>
              <label className="lbl text-white/70">Tu enlace de reservas
                <div className="mt-1 flex items-center overflow-hidden rounded-2xl bg-white text-ink"><span className="whitespace-nowrap pl-3 text-sm text-ink/50">{origin.replace(/^https?:\/\//, "")}/</span><input className="min-w-0 flex-1 bg-transparent px-1 py-3 font-bold outline-none" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} /></div></label>
              <button className="btn w-full" disabled={busy}>{busy ? "Guardando…" : "Continuar"}</button>
              {err && <p className="text-sm text-[#FFB4C2]">{err}</p>}
            </form>}

            {step === 6 && <div className="space-y-4"><WhatsAppConnect onSkip={() => go(7)} onConnected={() => go(7)} /></div>}

            {step === 7 && <div className="space-y-4 text-center">
              <h1 className="display text-5xl">¡Listo, {biz?.name}!</h1>
              {trialDays !== null && <div className="mx-auto inline-block rounded-full bg-[#D6FF4A] px-4 py-2 text-sm font-extrabold text-[#070B14]">{trialDays} {trialDays === 1 ? "día" : "días"} de prueba con todo incluido</div>}
              <p className="text-white/75">Este es tu enlace de reservas. Compártelo en Instagram o por WhatsApp.</p>
              <div className="break-all rounded-2xl bg-white/10 px-3 py-3 text-left text-sm">{link}</div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn2" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setErr("No se pudo copiar. Copia el enlace a mano."); } }}>{copied ? "Copiado" : "Copiar enlace"}</button>
                <a className="btn bg-[#25D366]" href={`https://wa.me/?text=${encodeURIComponent(`Reserva tu cita en ${biz?.name}: ${link}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
              </div>
              {err && <p className="text-sm text-[#FFB4C2]">{err}</p>}
              <button className="btn-gold w-full" onClick={() => router.push("/app")}>Ir al inicio</button>
            </div>}

          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
