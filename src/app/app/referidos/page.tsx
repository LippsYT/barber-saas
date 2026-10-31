"use client";
import { useState } from "react";
import { Check, Copy, Gift, Share2 } from "lucide-react";
import { useApp } from "@/components/ctx";
import { appBaseUrl } from "@/lib/messaging/templates";

export default function Referidos() {
  const { biz } = useApp();
  const url = `${appBaseUrl()}/login?modo=registro&ref=${encodeURIComponent(biz.slug)}`;
  const text = `Uso Pulso para la agenda, la caja y las reservas de mi barbería. Pruébalo: ${url}`;
  const [copied, setCopied] = useState(false); const [err, setErr] = useState("");
  async function copy() { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setErr("No se pudo copiar. Mantén presionado el enlace para copiarlo."); } }
  async function share() { try { if (navigator.share) await navigator.share({ title: "Pulso", text, url }); else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank"); } catch { /* cerró el menú */ } }
  return (
    <main className="min-w-0 space-y-4">
      <div><div className="eyebrow mb-1">Crece con tu gente</div><h1 className="h1 !mb-0">Referidos</h1></div>
      <section className="rounded-[1.7rem] bg-ink p-5 text-white">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#D6FF4A] text-ink"><Gift className="h-6 w-6" /></div>
        <h2 className="display mt-3 text-4xl">Invita a otra <span className="bg-[#D6FF4A] px-1 text-ink">barbería</span></h2>
        <p className="mt-2 text-sm text-white/75">Comparte tu enlace con colegas barberos para que prueben Pulso. Por ahora el enlace solo los lleva a crear su cuenta; todavía no se mide quién viene de dónde.</p>
      </section>
      <section className="card space-y-3">
        <div className="font-display text-xl font-extrabold uppercase leading-none">Tu enlace de invitación</div>
        <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-ink/[0.04] p-2 pl-3">
          <span className="min-w-0 flex-1 truncate text-sm">{url.replace(/^https?:\/\//, "")}</span>
          <button aria-label="Copiar enlace" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-sm" onClick={copy}>{copied ? <Check className="h-4 w-4 text-[#14944A]" /> : <Copy className="h-4 w-4" />}</button>
        </div>
        <button className="btn w-full" onClick={share}><Share2 className="h-4 w-4" />Compartir por WhatsApp</button>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      </section>
    </main>
  );
}
