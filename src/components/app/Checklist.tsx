"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { sb } from "@/lib/supabase";
import { appBaseUrl } from "@/lib/messaging/templates";

type Step = { id: string; label: string; done: boolean; href?: string; action?: () => void; cta?: string };

/** Primeros pasos: anillo de progreso + lista. Se oculta cuando los 4 pasos están hechos. */
export function Checklist({ bizId, slug, name }: { bizId: string; slug: string; name: string }) {
  const sharedKey = `pulso:shared:${bizId}`;
  const [services, setServices] = useState<number | null>(null);
  const [wa, setWa] = useState<boolean | null>(null);
  const [shared, setShared] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    try { setShared(localStorage.getItem(sharedKey) === "1"); } catch { /* sin storage */ }
    (async () => {
      const [{ count }, { data: link }] = await Promise.all([
        sb().from("services").select("id", { count: "exact", head: true }).eq("business_id", bizId).eq("active", true),
        sb().from("whatsapp_links").select("status").eq("business_id", bizId).maybeSingle(),
      ]);
      setServices(count ?? 0);
      setWa(link?.status === "connected");
    })();
  }, [bizId, sharedKey]);

  async function share() {
    const url = `${appBaseUrl()}/l/${slug}`;
    try {
      if (navigator.share) await navigator.share({ title: name, text: `Reserva en ${name}`, url });
      else { await navigator.clipboard.writeText(url); setNote("Link copiado. Pégalo en WhatsApp o Instagram."); }
      localStorage.setItem(sharedKey, "1"); setShared(true);
    } catch { /* el usuario cerró el menú de compartir */ }
  }

  if (services === null || wa === null) return null;
  const steps: Step[] = [
    { id: "account", label: "Crea tu cuenta", done: true },
    { id: "share", label: "Comparte tu Pulse Link", done: shared, action: share, cta: "Compartir" },
    { id: "wa", label: "Conecta tu WhatsApp", done: wa, href: "/app/whatsapp", cta: "Conectar" },
    { id: "service", label: "Agrega tu primer servicio", done: services > 0, href: "/app/servicios", cta: "Agregar" },
  ];
  const n = steps.filter((s) => s.done).length;
  if (n === steps.length) return null;
  const R = 22, C = 2 * Math.PI * R;
  return (
    <section aria-label="Primeros pasos" className="card min-w-0 space-y-3 p-4">
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-14 shrink-0">
          <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90" aria-hidden>
            <circle cx="28" cy="28" r={R} fill="none" stroke="rgba(7,11,20,.08)" strokeWidth="6" />
            <circle cx="28" cy="28" r={R} fill="none" stroke="#2F5BFF" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - n / steps.length)} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)" }} />
          </svg>
          <span className="absolute inset-0 grid place-items-center text-xs font-extrabold">{n}/{steps.length}</span>
        </div>
        <div className="min-w-0"><div className="font-display text-2xl font-extrabold uppercase leading-none">Pon tu negocio a recibir citas</div><div className="mt-1 text-sm text-ink/55">{n} de {steps.length} pasos completados</div></div>
      </div>
      <ul className="space-y-1.5">{steps.map((s) => (
        <li key={s.id} className={`flex min-h-[48px] items-center gap-3 rounded-2xl px-3 py-2 ${s.done ? "" : "bg-ink/[0.04]"}`}>
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${s.done ? "bg-[#14944A] text-white" : "border-2 border-ink/25"}`}>{s.done && <Check className="h-3.5 w-3.5" />}</span>
          <span className={`min-w-0 flex-1 text-sm font-semibold ${s.done ? "text-ink/45 line-through" : ""}`}>{s.label}</span>
          {!s.done && s.href && <Link href={s.href} className="btn min-h-[40px] shrink-0 px-4 py-2 text-sm">{s.cta}</Link>}
          {!s.done && s.action && <button type="button" onClick={s.action} className="btn min-h-[40px] shrink-0 px-4 py-2 text-sm">{s.cta}</button>}
        </li>))}
      </ul>
      {note && <p role="status" className="text-sm text-[#0B5B2B]">{note}</p>}
    </section>
  );
}
