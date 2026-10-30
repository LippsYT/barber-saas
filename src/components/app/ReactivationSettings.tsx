"use client";
import { useEffect, useState } from "react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { reactivationSettings, reactivationText } from "@/lib/messaging/templates";

/** Ajustes del «recordatorio de regreso» (settings.reactivation). */
export function ReactivationSettings() {
  const { biz } = useApp();
  const [enabled, setEnabled] = useState(false); const [days, setDays] = useState(25); const [msg, setMsg] = useState("");
  useEffect(() => {
    sb().from("businesses").select("settings").eq("id", biz.id).single().then(({ data }) => {
      const r = reactivationSettings(data?.settings); setEnabled(r.enabled); setDays(r.days);
    });
  }, [biz.id]);
  async function save() {
    setMsg("");
    const { error } = await sb().rpc("set_reactivation_settings", { p_enabled: enabled, p_days: days });
    setMsg(error ? (error.message.includes("bad_days") ? "Usa entre 7 y 365 días." : errEs(error)) : "Guardado.");
  }
  return (
    <section className="card space-y-3">
      <div className="font-bold">Recordatorio de regreso</div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enviar automático a clientes que no vuelven (solo con permiso de WhatsApp)
      </label>
      <label className="block text-sm">Días desde el último corte
        <input className="inp mt-1" type="number" inputMode="numeric" min={7} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} />
      </label>
      <p className="rounded-lg bg-black/5 p-3 text-sm text-ink/70">{reactivationText("Juan", days, biz.name ?? "tu barbería", "…/" + (biz.slug ?? ""))}</p>
      <button className="btn" onClick={save}>Guardar</button>
      {msg && <p className="text-sm" role="status">{msg}</p>}
    </section>
  );
}
