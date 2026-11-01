"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, X } from "lucide-react";
import { enablePush, pushState, registerWorker } from "@/lib/pushClient";

const KEY = "pulso_push_prompt_off";
const installed = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

/** Cuando la app ya está en la pantalla de inicio y aún no hay avisos activados, lo propone una vez. */
export function PushPrompt() {
  const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => {
    registerWorker();
    let hidden = false;
    try { hidden = localStorage.getItem(KEY) === "1"; } catch { /* sin almacenamiento: se muestra */ }
    if (hidden || !installed()) return;
    pushState().then((s) => setShow(s === "off"));
  }, []);
  if (!show) return null;
  const hide = () => { try { localStorage.setItem(KEY, "1"); } catch { /* ignorar */ } setShow(false); };
  return (
    <div role="region" aria-label="Notificaciones" className="mx-4 mb-2 flex items-start gap-3 rounded-2xl bg-ink p-3 text-white">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#D6FF4A] text-ink"><BellRing className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-extrabold">Entérate al instante de cada reserva</div>
        <p className="text-xs text-white/70">Activa las notificaciones y te avisamos cuando un cliente reserve o cancele.</p>
        <div className="mt-2 flex items-center gap-3">
          <button className="rounded-xl bg-[#D6FF4A] px-3 py-1.5 text-xs font-extrabold text-ink" disabled={busy}
            onClick={async () => { setBusy(true); const e = await enablePush(); setBusy(false); if (e) setErr(e); else setShow(false); }}>{busy ? "Activando…" : "Activar"}</button>
          <Link href="/app/notificaciones" className="text-xs font-bold text-white/70 underline">Más info</Link>
        </div>
        {err && <p role="alert" className="mt-1 text-xs text-red-200">{err}</p>}
      </div>
      <button aria-label="Ahora no" className="shrink-0 p-1 text-white/60" onClick={hide}><X className="h-4 w-4" /></button>
    </div>
  );
}
