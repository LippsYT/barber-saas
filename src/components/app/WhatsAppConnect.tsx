"use client";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

type Stage = "form" | "code" | "done";

export function WhatsAppConnect({
  onConnected, onSkip, preview,
}: {
  onConnected?: () => void;
  onSkip?: () => void;
  /** Si viene, no llama a la API: sirve para la vista previa. */
  preview?: { stage: Stage; code?: string; demo?: boolean };
}) {
  const [stage, setStage] = useState<Stage>(preview?.stage ?? "form");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState(preview?.code ?? "");
  const [demo, setDemo] = useState(preview?.demo ?? false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(body: Record<string, string>) {
    const res = await fetch("/api/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "No se pudo conectar.");
    return data as { status?: string; pairingCode?: string; demo?: boolean };
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (preview) return;
    setBusy(true); setErr("");
    try {
      const data = await call({ action: "start", phone });
      setCode(data.pairingCode ?? "");
      setDemo(Boolean(data.demo));
      setStage("code");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function refresh() {
    if (preview) return;
    try {
      const data = await call({ action: "status" });
      if (data.demo) setDemo(true);
      if (data.status === "connected") { setStage("done"); onConnected?.(); }
    } catch { /* el siguiente sondeo reintenta */ }
  }

  async function confirmDemo() {
    if (preview) { setStage("done"); return; }
    setBusy(true); setErr("");
    try {
      await call({ action: "demo-confirm" });
      setStage("done");
      onConnected?.();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  useEffect(() => {
    if (preview || stage !== "code" || demo) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [stage, demo, preview]);

  if (stage === "done" || preview?.stage === "done") {
    return (
      <div className="rounded-[1.7rem] bg-[#07362a] p-5 text-center text-white">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#25D366]"><MessageCircle /></div>
        <h2 className="mt-3 font-display text-3xl font-extrabold uppercase">¡Listo!</h2>
        <p className="mt-2 text-sm text-white/80">Tu WhatsApp quedó marcado como conectado{demo || preview?.demo ? " (modo demo)" : ""}.</p>
      </div>
    );
  }

  if (stage === "code") {
    const pretty = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
    return (
      <div className="space-y-4">
        <div className="rounded-[1.7rem] bg-ink p-5 text-white">
          <div className="text-xs font-extrabold uppercase tracking-widest text-[#D6FF4A]">Código de vinculación</div>
          <div className="mt-3 text-center font-display text-5xl font-extrabold tracking-[0.18em]">{pretty}</div>
          <ol className="mt-4 list-decimal space-y-1 pl-4 text-sm text-white/75">
            <li>Abre WhatsApp en el teléfono de la barbería.</li>
            <li>Ve a Ajustes → Dispositivos vinculados → Vincular con número.</li>
            <li>Escribe este código de 8 caracteres.</li>
          </ol>
        </div>
        {(demo || preview?.demo) && (
          <div className="rounded-2xl border border-[#D6FF4A] bg-[#F4FFC8] p-3 text-sm">
            <b>Modo demo.</b> No hay <span className="font-mono">EVOLUTION_API_URL</span>. Este código no vincula un WhatsApp real.
          </div>
        )}
        {demo ? <button className="btn w-full" disabled={busy} onClick={confirmDemo}>Ya introduje el código</button> : <button className="btn2 w-full" onClick={refresh}>Ya lo vinculé, revisar</button>}
        {onSkip && <button className="w-full text-sm font-semibold text-ink/50" onClick={onSkip}>Ahora no</button>}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={start} className="space-y-3">
      <h2 className="font-display text-3xl font-extrabold uppercase leading-none">Conecta tu WhatsApp</h2>
      <p className="text-sm text-ink/65">Escribe el número con código de país. Te damos un código de 8 caracteres para vincularlo, sin la API oficial de Meta.</p>
      <label className="lbl">Número de WhatsApp
        <input className="inp mt-1" inputMode="tel" required placeholder="593999111222" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <button className="btn w-full" disabled={busy}>{busy ? "Pidiendo código…" : "Mostrar código"}</button>
      {onSkip && <button type="button" className="w-full text-sm font-semibold text-ink/50" onClick={onSkip}>Saltar este paso</button>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </form>
  );
}
