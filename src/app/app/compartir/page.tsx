"use client";
import { useState } from "react";
import { CalendarCheck, Clock, Download, Scissors, Share2, Users } from "lucide-react";
import { useApp } from "@/components/ctx";

const KINDS = [
  { key: "reservas", label: "Reservas online", hint: "Agenda sin mensajes", icon: CalendarCheck },
  { key: "horario", label: "Horario", hint: "Cuándo atiendes", icon: Clock },
  { key: "servicios", label: "Servicios", hint: "Con sus precios", icon: Scissors },
  { key: "equipo", label: "Equipo", hint: "Quién te atiende", icon: Users },
] as const;

export default function Compartir() {
  const { biz } = useApp();
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("reservas");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [stamp, setStamp] = useState(0);
  const src = `/api/og/share/${biz.slug}?kind=${kind}&v=${stamp}`;

  async function blob(): Promise<File> {
    const r = await fetch(src); if (!r.ok) throw new Error("No se pudo generar la imagen.");
    return new File([await r.blob()], `${biz.slug}-${kind}.png`, { type: "image/png" });
  }
  async function download() {
    setBusy(true); setErr("");
    try { const f = await blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function share() {
    setBusy(true); setErr("");
    try {
      const f = await blob();
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: biz.name });
      else await download();
    } catch (e) { if ((e as Error).name !== "AbortError") setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <main className="min-w-0 space-y-4">
      <div><div className="eyebrow mb-1">Tu marca</div><h1 className="h1 !mb-0">Contenido para compartir</h1></div>
      <p className="text-sm text-ink/60">Piezas listas con el nombre y los datos de tu negocio para tus historias y publicaciones. Elige una, descárgala o compártela.</p>
      <div className="grid grid-cols-2 gap-2">{KINDS.map(({ key, label, hint, icon: Icon }) => (
        <button key={key} aria-pressed={kind === key} onClick={() => { setKind(key); setStamp(Date.now()); }} className={`min-w-0 rounded-2xl border p-3 text-left ${kind === key ? "border-[#2F5BFF] bg-[#2F5BFF] text-white" : "border-black/10 bg-white"}`}>
          <Icon className="h-5 w-5" /><span className="mt-2 block font-bold">{label}</span><span className={`block text-xs ${kind === key ? "text-white/80" : "text-ink/55"}`}>{hint}</span>
        </button>))}</div>
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl bg-ink/10 shadow-lg"><img key={src} src={src} alt={`Pieza de ${kind}`} className="aspect-[1080/1350] w-full object-cover" /></div>
      <div className="grid grid-cols-2 gap-2"><button className="btn" disabled={busy} onClick={share}><Share2 className="h-4 w-4" />Compartir</button><button className="btn2" disabled={busy} onClick={download}><Download className="h-4 w-4" />Descargar</button></div>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
    </main>
  );
}
