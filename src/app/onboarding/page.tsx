"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { isReservedSlug } from "@/lib/reserved";
import { sb, errEs } from "@/lib/supabase";
import { ServiceEditor, emptyServiceDraft, type ServiceDraft } from "@/components/app/ServiceEditor";
import { WhatsAppConnect } from "@/components/app/WhatsAppConnect";
import { saveServiceBundle } from "@/lib/saveService";
import { Logo } from "@/components/brand/Logo";
import { Chispa } from "@/components/brand/Mascot";

const TZ = [["America/Guayaquil", "Ecuador"], ["America/Bogota", "Colombia"], ["America/Argentina/Buenos_Aires", "Argentina"], ["America/Mexico_City", "México"], ["America/Santiago", "Chile"], ["America/Lima", "Perú"], ["America/New_York", "EE. UU. (Este)"]] as const;
const STEPS = ["Colaboradores", "Servicios", "Tu negocio", "WhatsApp", "Listo"];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [biz, setBiz] = useState<{ id: string; slug: string; name: string; timezone: string } | null>(null);
  const [shop, setShop] = useState(""); const [me, setMe] = useState(""); const [tz, setTz] = useState(0); const [bookable, setBookable] = useState(true);
  const [collabs, setCollabs] = useState<{ name: string }[]>([]); const [collab, setCollab] = useState("");
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [making, setMaking] = useState(false);
  const [phone, setPhone] = useState(""); const [address, setAddress] = useState(""); const [slug, setSlug] = useState("");
  const [coverUrl, setCoverUrl] = useState(""); const [coverNote, setCoverNote] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { (async () => {
    const { data: u } = await sb().auth.getUser();
    if (!u.user) return router.replace("/login");
    const { data } = await sb().from("memberships").select("id, display_name, business:businesses(id,name,slug,timezone,phone,address,cover_url)").eq("user_id", u.user.id).eq("active", true).limit(1);
    const m = data?.[0] as any;
    if (m?.business) {
      setBiz(m.business); setShop(m.business.name); setMe(m.display_name ?? ""); setSlug(m.business.slug);
      setPhone(m.business.phone ?? ""); setAddress(m.business.address ?? ""); setCoverUrl(m.business.cover_url ?? "");
      await refreshTeam(m.business.id);
    }
    setReady(true);
  })(); }, [router]);

  async function refreshTeam(id: string) {
    const [{ data: mem }, { data: svc }] = await Promise.all([
      sb().from("memberships").select("id, display_name").eq("business_id", id).eq("active", true).eq("is_bookable", true).order("display_name"),
      sb().from("services").select("id, name").eq("business_id", id).eq("active", true).order("name"),
    ]);
    setMembers((mem ?? []).map((x: any) => ({ id: x.id, name: x.display_name })));
    setServices(svc ?? []);
  }

  async function saveTeam(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    let current = biz;
    if (!current) {
      if (slug && isReservedSlug(slug)) { setBusy(false); return setErr("Ese enlace está reservado. Elige otro."); }
      const { data, error } = await sb().rpc("create_business", { p_name: shop, p_slug: slug, p_display_name: me, p_timezone: TZ[tz][0], p_currency: "USD", p_owner_bookable: bookable });
      if (error) { setBusy(false); return setErr(errEs(error)); }
      const { data: row } = await sb().from("businesses").select("id, slug, name, timezone").eq("id", data).single();
      const created = row as { id: string; slug: string; name: string; timezone: string };
      current = created; setBiz(created); setSlug(created.slug); setShop(created.name);
    }
    for (const c of collabs) {
      const { error } = await sb().from("memberships").insert({ business_id: current!.id, display_name: c.name, role: "barber", is_bookable: true });
      if (error) { setBusy(false); return setErr(errEs(error)); }
    }
    setCollabs([]);
    await refreshTeam(current!.id);
    setBusy(false); setStep(1);
  }

  async function addService(draft: ServiceDraft) {
    if (!biz) return;
    setBusy(true); setErr("");
    const res = await saveServiceBundle(biz.id, null, draft);
    setBusy(false);
    if ("error" in res) return setErr(res.error);
    setMaking(false); await refreshTeam(biz.id);
  }

  async function uploadCover(file: File) {
    if (!biz) return;
    setCoverNote("");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${biz.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb().storage.from("covers").upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
    if (error) {
      setCoverNote("No se pudo subir a Storage. Pega una URL de la imagen o sigue con el recuadro vacío.");
      return;
    }
    const { data } = sb().storage.from("covers").getPublicUrl(path);
    setCoverUrl(data.publicUrl);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); if (!biz) return; setErr(""); setBusy(true);
    const nextSlug = slug.trim() || biz.slug;
    if (isReservedSlug(nextSlug)) { setBusy(false); return setErr("Ese enlace está reservado."); }
    const { error } = await sb().from("businesses").update({ name: shop.trim(), phone: phone.trim() || null, address: address.trim() || null, cover_url: coverUrl.trim() || null, slug: nextSlug }).eq("id", biz.id);
    setBusy(false);
    if (error) return setErr(errEs(error));
    setBiz({ ...biz, name: shop.trim(), slug: nextSlug }); setStep(3);
  }

  const link = biz ? `${typeof window !== "undefined" ? window.location.origin : ""}/${biz.slug}` : "";

  if (!ready) return <main className="grid min-h-screen place-items-center"><Logo light /></main>;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-[calc(1.25rem+var(--sab))] pt-[calc(1.25rem+var(--sat))]">
      <div className="mb-6 flex items-center justify-between">
        <button aria-label="Atrás" className="grid h-10 w-10 place-items-center rounded-full bg-white/10" onClick={() => step === 0 ? router.push("/") : setStep(step - 1)}><ChevronLeft /></button>
        <div className="text-sm font-extrabold">Configura tu cuenta</div>
        <div className="flex gap-1">{STEPS.map((_, i) => <span key={i} className={`h-2 rounded-full ${i === step ? "w-6 bg-[#2F5BFF]" : "w-2 bg-white/25"}`} />)}</div>
      </div>

      {step === 0 && <form onSubmit={saveTeam} className="space-y-3">
        <h1 className="display text-4xl">Colaboradores</h1>
        <p className="text-sm text-white/70">Primero el equipo. Tú quedas como dueño. Los demás pueden atender sin tener cuenta todavía.</p>
        {!biz && <>
          <label className="lbl text-white/70">Nombre de la barbería<input className="inp mt-1 text-ink" required value={shop} onChange={(e) => setShop(e.target.value)} /></label>
          <label className="lbl text-white/70">Tu nombre<input className="inp mt-1 text-ink" required value={me} onChange={(e) => setMe(e.target.value)} /></label>
          <label className="lbl text-white/70">País<select className="inp mt-1 text-ink" value={tz} onChange={(e) => setTz(Number(e.target.value))}>{TZ.map((t, i) => <option key={t[0]} value={i}>{t[1]}</option>)}</select></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bookable} onChange={(e) => setBookable(e.target.checked)} /> Yo también atiendo clientes</label>
        </>}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 font-bold">Añadir colaborador</div>
          <div className="flex gap-2"><input className="inp text-ink" placeholder="Nombre" value={collab} onChange={(e) => setCollab(e.target.value)} />
            <button type="button" className="btn" onClick={() => { if (collab.trim()) { setCollabs([...collabs, { name: collab.trim() }]); setCollab(""); } }}>Añadir</button></div>
          <ul className="mt-3 space-y-2">{collabs.map((c, i) => <li key={i} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-ink"><span><b>{c.name}</b><span className="ml-2 text-xs text-ink/50">Barbero</span></span><button type="button" className="text-sm" onClick={() => setCollabs(collabs.filter((_, j) => j !== i))}>Quitar</button></li>)}</ul>
        </div>
        <button className="btn w-full" disabled={busy}>{busy ? "Guardando…" : "Siguiente"}</button>
        {err && <p className="text-sm text-[#FFB4C2]">{err}</p>}
      </form>}

      {step === 1 && <div className="space-y-3">
        <h1 className="display text-4xl">Crea tus servicios</h1>
        <p className="text-sm text-white/70">Nombre, precio en dólares, duración y, en Colaboradores, la comisión de cada quien.</p>
        <ul className="space-y-2">{services.map((s) => <li key={s.id} className="rounded-2xl bg-white px-3 py-2 font-semibold text-ink">{s.name}</li>)}</ul>
        {making ? <div className="rounded-3xl bg-white p-4 text-ink"><ServiceEditor members={members} initial={emptyServiceDraft(members)} busy={busy} error={err} onSubmit={addService} onCancel={() => setMaking(false)} /></div>
          : <button className="btn2 w-full text-ink" onClick={() => setMaking(true)}>Crear servicio</button>}
        <div className="flex gap-2"><button className="btn2 flex-1" onClick={() => setStep(0)}>Atrás</button><button className="btn flex-1" onClick={() => setStep(2)}>Siguiente</button></div>
      </div>}

      {step === 2 && <form onSubmit={saveProfile} className="space-y-3">
        <h1 className="display text-4xl">Datos del negocio</h1>
        <p className="text-sm text-white/70">Puedes revisar el nombre, el teléfono y la foto de portada.</p>
        <label className="grid cursor-pointer place-items-center rounded-3xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-sm">
          {coverUrl ? <img src={coverUrl} alt="" className="mb-2 h-28 w-full rounded-2xl object-cover" /> : <span className="mb-2 grid h-12 w-12 place-items-center rounded-full bg-[#2F5BFF] text-xl">＋</span>}
          Agregar imagen de portada
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCover(f); }} />
        </label>
        {coverNote && <p className="text-sm text-[#FFE08A]">{coverNote}</p>}
        <label className="lbl text-white/70">O pega la URL de la portada<input className="inp mt-1 text-ink" placeholder="https://…" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} /></label>
        <label className="lbl text-white/70">Nombre<input className="inp mt-1 text-ink" required value={shop} onChange={(e) => setShop(e.target.value)} /></label>
        <label className="lbl text-white/70">Teléfono<input className="inp mt-1 text-ink" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="lbl text-white/70">Dirección<input className="inp mt-1 text-ink" value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        <label className="lbl text-white/70">Enlace de reservas<input className="inp mt-1 text-ink" value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
        <div className="flex gap-2"><button type="button" className="btn2 flex-1" onClick={() => setStep(1)}>Atrás</button><button className="btn flex-1" disabled={busy}>{busy ? "Guardando…" : "Siguiente"}</button></div>
        {err && <p className="text-sm text-[#FFB4C2]">{err}</p>}
      </form>}

      {step === 3 && <div className="space-y-4">
        <WhatsAppConnect onSkip={() => setStep(4)} onConnected={() => setStep(4)} />
      </div>}

      {step === 4 && <div className="space-y-4 text-center">
        <Chispa pose="wave" className="mx-auto w-40" />
        <h1 className="display text-5xl">¡Felicitaciones!</h1>
        <p className="text-white/75">Este es tu link de reservas. Compártelo en Instagram o por WhatsApp.</p>
        <div className="rounded-2xl bg-white/10 px-3 py-3 text-left text-sm break-all">{link}</div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn2" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); }}> {copied ? "Copiado" : "Copiar enlace"}</button>
          <a className="btn bg-[#25D366]" href={`https://wa.me/?text=${encodeURIComponent(`Reserva tu cita en ${biz?.name}: ${link}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
        </div>
        <button className="btn-gold w-full" onClick={() => router.push("/app")}>Ir al inicio</button>
      </div>}
    </main>
  );
}
