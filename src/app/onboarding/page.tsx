"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sb, errEs } from "@/lib/supabase";

const TZ = [["America/Bogota", "Colombia (COP)", "COP"], ["America/Argentina/Buenos_Aires", "Argentina (ARS)", "ARS"], ["America/Mexico_City", "México (MXN)", "MXN"], ["America/Santiago", "Chile (CLP)", "CLP"], ["America/Lima", "Perú (PEN)", "PEN"]];

export default function Onboarding() {
  const router = useRouter();
  const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [me, setMe] = useState("");
  const [tz, setTz] = useState(0); const [bookable, setBookable] = useState(true);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const { error } = await sb().rpc("create_business", { p_name: name, p_slug: slug, p_display_name: me, p_timezone: TZ[tz][0], p_currency: TZ[tz][2], p_owner_bookable: bookable });
    setBusy(false);
    if (error) return setErr(errEs(error));
    router.push("/app/servicios?nuevo=1");
  }
  return (
    <main className="pt-6">
      <h1 className="h1">Crea tu barbería</h1>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="lbl">Nombre de la barbería</label><input className="inp" required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="lbl">Enlace de reservas (opcional)</label><input className="inp" placeholder="mi-barberia" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1">Tus clientes reservarán en /b/{slug || "mi-barberia"}</p></div>
        <div><label className="lbl">Tu nombre</label><input className="inp" required value={me} onChange={(e) => setMe(e.target.value)} /></div>
        <div><label className="lbl">País</label><select className="inp" value={tz} onChange={(e) => setTz(Number(e.target.value))}>{TZ.map((t, i) => <option key={i} value={i}>{t[1]}</option>)}</select></div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={bookable} onChange={(e) => setBookable(e.target.checked)} /> Yo también atiendo clientes</label>
        <button className="btn-gold w-full" disabled={busy}>{busy ? "Creando…" : "Crear barbería"}</button>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>
    </main>
  );
}
