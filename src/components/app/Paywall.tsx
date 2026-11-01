"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

/** Pantalla que reemplaza la app cuando la prueba terminó y no hay suscripción al día. */
export function Paywall({ isOwner, businessName, onLogout }: { isOwner: boolean; businessName: string; onLogout: () => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function subscribe() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "checkout" }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) { const p = await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "portal" }) }); const pj = await p.json().catch(() => ({})); if (pj.url) { location.href = pj.url; return; } }
      if (!r.ok || !j.url) { setErr(j.error || "No se pudo abrir el pago."); setBusy(false); return; }
      location.href = j.url;
    } catch { setErr("No se pudo abrir el pago."); setBusy(false); }
  }
  return (
    <main className="paper-blue grid min-h-screen place-items-center px-5 py-10 text-white">
      <div className="w-full max-w-md space-y-5 text-center">
        <div className="flex justify-center"><Logo light className="text-2xl" /></div>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#D6FF4A] text-[#070B14]"><Lock className="h-8 w-8" /></div>
        <h1 className="display text-5xl">Tu prueba terminó</h1>
        <p className="text-white/80">{isOwner
          ? `Para seguir usando Pulso en ${businessName}, activa tu suscripción. Tus datos están guardados y vuelven en cuanto pagues. Mientras tanto, tus clientes no pueden reservar.`
          : `La suscripción de ${businessName} necesita renovarse. Avísale al dueño del negocio para que la active.`}</p>
        {isOwner && <button className="btn-gold w-full" disabled={busy} onClick={() => { setBusy(true); location.href = "/app/suscripcion"; }}>{busy ? "Abriendo…" : "Elegir mi plan"}</button>}
        {err && <p role="alert" className="text-sm text-red-200">{err}</p>}
        <button className="text-sm font-semibold text-white/70 underline" onClick={onLogout}>Salir</button>
      </div>
    </main>
  );
}
