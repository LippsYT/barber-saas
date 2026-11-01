"use client";
import { useEffect, useState } from "react";
import { BellRing, Check, Share } from "lucide-react";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/pushClient";

export default function Notificaciones() {
  const [st, setSt] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [note, setNote] = useState("");
  const refresh = () => pushState().then(setSt);
  useEffect(() => { refresh(); }, []);

  async function on() { setBusy(true); setErr(""); const e = await enablePush(); if (e) setErr(e); await refresh(); setBusy(false); }
  async function off() { setBusy(true); setErr(""); setNote(""); await disablePush(); await refresh(); setBusy(false); }
  async function test() {
    setBusy(true); setErr(""); setNote("");
    try {
      const r = await fetch("/api/push/test", { method: "POST" }); const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j.error || "No se pudo enviar la prueba."); else setNote("Listo: te mandamos un aviso. Debería llegar en unos segundos.");
    } catch { setErr("No se pudo enviar la prueba."); }
    setBusy(false);
  }

  return (
    <main className="min-w-0 space-y-4">
      <div><div className="eyebrow mb-1">Ajustes</div><h1 className="h1 !mb-0">Notificaciones</h1></div>
      <section className="rounded-[1.7rem] bg-ink p-5 text-white">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#D6FF4A] text-ink"><BellRing className="h-6 w-6" /></div>
        <div className="mt-3 text-[11px] font-extrabold uppercase tracking-widest text-[#D6FF4A]">En este celular</div>
        <div className="font-display text-4xl font-extrabold leading-none">{st === null ? "…" : st === "on" ? "Activadas" : st === "blocked" ? "Bloqueadas" : st === "unsupported" ? "No disponibles" : "Apagadas"}</div>
        <p className="mt-2 text-sm text-white/70">Te avisamos al instante, aunque la app esté cerrada.</p>
      </section>

      {st === "needs-install" && (
        <section className="card space-y-3">
          <h2 className="font-display text-xl font-extrabold uppercase">Primero instala Pulso</h2>
          <p className="text-sm text-ink/70">En iPhone, las notificaciones solo funcionan si Pulso está en tu pantalla de inicio:</p>
          <ol className="space-y-2 text-sm">
            <li className="flex gap-2"><b>1.</b><span>Abre Pulso en <b>Safari</b>.</span></li>
            <li className="flex gap-2"><b>2.</b><span>Toca el botón <b>Compartir</b> <Share className="inline h-4 w-4" /> de abajo.</span></li>
            <li className="flex gap-2"><b>3.</b><span>Elige <b>Añadir a pantalla de inicio</b> y confirma.</span></li>
            <li className="flex gap-2"><b>4.</b><span>Abre Pulso desde el ícono nuevo y vuelve a esta pantalla.</span></li>
          </ol>
        </section>
      )}
      {st === "unsupported" && <section className="card"><p className="text-sm text-ink/70">Este navegador no admite notificaciones. Prueba con Chrome, Edge o Safari (iPhone con iOS 16.4 o más).</p></section>}
      {st === "blocked" && <section className="card space-y-1"><h2 className="font-display text-xl font-extrabold uppercase">Las bloqueaste</h2><p className="text-sm text-ink/70">Para activarlas, permite las notificaciones de Pulso en los ajustes del celular o del navegador y vuelve aquí.</p></section>}

      {(st === "off" || st === "on") && (
        <section className="card space-y-3">
          {st === "off" && <button className="btn w-full" disabled={busy} onClick={on}>{busy ? "Activando…" : "Activar notificaciones"}</button>}
          {st === "on" && <>
            <p className="flex items-center gap-2 text-sm font-semibold text-[#14944A]"><Check className="h-4 w-4" />Este celular recibirá los avisos.</p>
            <button className="btn w-full" disabled={busy} onClick={test}>{busy ? "Enviando…" : "Enviar un aviso de prueba"}</button>
            <button className="btn2 w-full" disabled={busy} onClick={off}>Desactivar en este celular</button>
          </>}
          {note && <p role="status" className="text-sm font-semibold text-[#14944A]">{note}</p>}
          {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        </section>
      )}

      <section className="card space-y-2">
        <h2 className="font-display text-xl font-extrabold uppercase">Qué te avisamos</h2>
        <ul className="space-y-1.5 text-sm">
          <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#14944A]" />Cuando un cliente reserva desde tu link.</li>
          <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#14944A]" />Cuando un cliente cancela su cita.</li>
        </ul>
        <p className="text-xs text-ink/55">Los avisos llegan al dueño, a los admins y al barbero de esa cita. Cada persona los activa en su propio celular.</p>
      </section>
    </main>
  );
}
