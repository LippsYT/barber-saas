"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { uploadBusinessImage } from "@/lib/imageUpload";
import { isReservedSlug } from "@/lib/reserved";
import { appBaseUrl } from "@/lib/messaging/templates";

type Img = { id: string; url: string };

export default function Perfil() {
  const { biz, role } = useApp();
  const isOwner = role === "owner";
  const [f, setF] = useState({ name: biz.name, phone: "", address: "", cover_url: "" });
  const [gallery, setGallery] = useState<Img[]>([]);
  const [slug, setSlug] = useState(biz.slug);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const coverPick = useRef<HTMLInputElement>(null); const galPick = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [{ data: b }, { data: g }] = await Promise.all([
      sb().from("businesses").select("name,phone,address,cover_url").eq("id", biz.id).single(),
      sb().from("portfolio_images").select("id,url").eq("business_id", biz.id).order("sort_order").order("created_at"),
    ]);
    if (b) setF({ name: b.name ?? "", phone: b.phone ?? "", address: b.address ?? "", cover_url: b.cover_url ?? "" });
    setGallery((g ?? []) as Img[]);
  };
  useEffect(() => { load(); }, []);

  async function saveInfo(e?: React.FormEvent, patch: Partial<typeof f> = {}) {
    e?.preventDefault(); setErr(""); setOk("");
    const next = { ...f, ...patch };
    if (next.name.trim().length < 2) return setErr("Escribe el nombre del negocio.");
    const { error } = await sb().from("businesses").update({ name: next.name.trim(), phone: next.phone.trim() || null, address: next.address.trim() || null, cover_url: next.cover_url || null }).eq("id", biz.id);
    if (error) return setErr(errEs(error));
    setF(next); setOk("Guardado.");
  }
  async function pickCover(file: File) {
    setBusy("cover"); setErr("");
    try { const url = await uploadBusinessImage(biz.id, file, "cover", 1600); await saveInfo(undefined, { cover_url: url }); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }
  async function addImages(files: FileList) {
    setBusy("gallery"); setErr(""); setOk("");
    try {
      let n = gallery.length;
      for (const file of Array.from(files).slice(0, 8)) {
        const url = await uploadBusinessImage(biz.id, file, "g", 1280);
        const { error } = await sb().from("portfolio_images").insert({ business_id: biz.id, url, sort_order: n++ });
        if (error) throw new Error(errEs(error));
      }
      await load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }
  async function removeImage(id: string) { await sb().from("portfolio_images").delete().eq("id", id); load(); }
  async function changeSlug() {
    setErr(""); setOk("");
    const s = slug.trim().toLowerCase();
    if (s === biz.slug) return;
    if (isReservedSlug(s)) return setErr("Ese enlace está reservado, prueba otro.");
    if (!confirm(`Tu enlace pasará a ser ${appBaseUrl().replace(/^https?:\/\//, "")}/${s}. Los QR y enlaces que ya compartiste con el anterior dejarán de funcionar. ¿Cambiarlo?`)) return;
    const { error } = await sb().rpc("change_business_slug", { p_slug: s });
    if (error) return setErr(errEs(error).includes("invalid_slug") ? "Usa solo letras minúsculas, números y guiones (3 a 40 caracteres)." : errEs(error));
    location.reload();
  }

  return (
    <main className="min-w-0 space-y-4">
      <div><div className="eyebrow mb-1">Tu negocio</div><h1 className="h1 !mb-0">Perfil del negocio</h1></div>
      <input ref={coverPick} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ""; if (x) pickCover(x); }} />
      <input ref={galPick} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={(e) => { const x = e.target.files; if (x?.length) addImages(x); e.target.value = ""; }} />
      {ok && <p role="status" className="text-sm text-[#0B5B2B]">{ok}</p>}
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      {!isOwner && <p className="rounded-2xl bg-ink/[0.05] p-3 text-sm text-ink/70">Solo el dueño puede cambiar el perfil del negocio.</p>}

      <section className="card space-y-3">
        <button type="button" disabled={!isOwner || busy === "cover"} onClick={() => coverPick.current?.click()} className="relative grid h-44 w-full place-items-center overflow-hidden rounded-2xl bg-[#2F5BFF]/10 text-[#2F5BFF] disabled:opacity-70">
          {f.cover_url ? <img src={f.cover_url} alt="Portada" className="absolute inset-0 h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-1 text-sm font-semibold"><Camera className="h-7 w-7" />Agregar imagen de portada</span>}
          {f.cover_url && isOwner && <span className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-[#D6FF4A] text-ink shadow"><Camera className="h-4 w-4" /></span>}
        </button>
        {busy === "cover" && <p className="text-sm text-ink/60">Subiendo portada…</p>}
        <form onSubmit={saveInfo} className="space-y-2">
          <label className="block min-w-0"><span className="lbl">Nombre del negocio</span><input className="inp" required disabled={!isOwner} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="block min-w-0"><span className="lbl">WhatsApp / teléfono</span><input className="inp" type="tel" disabled={!isOwner} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
          <label className="block min-w-0"><span className="lbl">Dirección</span><input className="inp" disabled={!isOwner} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
          {isOwner && <button className="btn w-full">Guardar cambios</button>}
        </form>
      </section>

      <section className="card space-y-3">
        <div><div className="font-display text-xl font-extrabold uppercase leading-none">Portafolio</div><p className="mt-1 text-sm text-ink/60">Fotos de tus trabajos. Se ven en tu página de reservas.</p></div>
        {!gallery.length && <p className="rounded-2xl bg-ink/[0.04] p-4 text-center text-sm text-ink/55">Aún no has agregado imágenes a tu portafolio.</p>}
        <div className="grid grid-cols-3 gap-2">{gallery.map((g) => (
          <div key={g.id} className="relative aspect-square overflow-hidden rounded-xl bg-ink/10">
            <img src={g.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            {isOwner && <button aria-label="Quitar imagen" className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow" onClick={() => removeImage(g.id)}><Trash2 className="h-4 w-4 text-red-600" /></button>}
          </div>))}</div>
        {isOwner && <button className="btn2 w-full" disabled={busy === "gallery"} onClick={() => galPick.current?.click()}><ImagePlus className="h-4 w-4" />{busy === "gallery" ? "Subiendo…" : "Agregar fotos"}</button>}
      </section>

      <section className="card space-y-2">
        <div className="font-display text-xl font-extrabold uppercase leading-none">Enlace de reserva</div>
        <p className="text-sm text-ink/60">Es la dirección que comparten tus clientes. Si lo cambias, los QR y enlaces anteriores dejan de funcionar.</p>
        <div className="flex min-w-0 items-center overflow-hidden rounded-2xl border border-black/10 bg-white"><span className="shrink-0 pl-3 text-sm text-ink/50">{appBaseUrl().replace(/^https?:\/\//, "")}/</span>
          <input className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm font-semibold outline-none" disabled={!isOwner} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} aria-label="Enlace de reserva" /></div>
        {isOwner && <button className="btn2 w-full" disabled={slug === biz.slug || slug.length < 3} onClick={changeSlug}>Cambiar enlace</button>}
      </section>
    </main>
  );
}
