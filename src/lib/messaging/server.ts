import { createClient } from "@supabase/supabase-js";
import { getWhatsAppProvider } from "@/lib/whatsapp";
import { sendPolicy } from "./allowlist";
import { emailPolicy, getEmailProvider } from "./email";
import { appBaseUrl } from "./templates";
import { renderCardPng } from "@/lib/ogCard";
import { processQueue, type ClaimedMessage, type QueueRpc } from "./sender";

/** RPC de cola con el cliente anon + CRON_SECRET (validado en SQL contra vault). */
export function queueRpc(): QueueRpc {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, secret = process.env.CRON_SECRET;
  if (!url || !key || !secret) throw new Error("missing_env");
  const db = createClient(url, key, { auth: { persistSession: false } });
  return {
    async claim({ limit, appointmentId, id, fallbackInstance }) {
      const { data, error } = await db.rpc("msg_claim", { p_secret: secret, p_limit: limit, p_appointment: appointmentId ?? null, p_id: id ?? null, p_fallback_instance: fallbackInstance ?? null });
      if (error) throw new Error(error.message);
      return (data ?? []) as ClaimedMessage[];
    },
    async finish(id, status, providerId, err) {
      const { data, error } = await db.rpc("msg_finish", { p_secret: secret, p_id: id, p_status: status, p_provider_id: providerId ?? null, p_error: err ?? null });
      if (error) throw new Error(error.message);
      return String(data);
    },
  };
}

/** Instancia de respaldo SOLO fuera de producción (para probar negocios sin WhatsApp propio). */
function fallbackInstance() {
  return process.env.VERCEL_ENV === "production" ? undefined : process.env.WHATSAPP_FALLBACK_INSTANCE?.trim() || undefined;
}

export function runQueue(opts: { limit?: number; appointmentId?: string; id?: string } = {}) {
  return processQueue(queueRpc(), getWhatsAppProvider(), sendPolicy(), { ...opts, fallbackInstance: fallbackInstance(), baseUrl: appBaseUrl(), card: renderCardPng },
    { provider: getEmailProvider(), policy: emailPolicy() });
}
