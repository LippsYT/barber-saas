import type { WhatsAppProvider } from "@/lib/whatsapp/types";
import { allowedToSend, digits, type SendPolicy } from "./allowlist";
import { emailSubject, type EmailProvider } from "./email";

export interface ClaimedMessage {
  id: string; business_id: string; kind: string; to_phone: string | null; body: string | null; attempts: number; instance_name: string | null;
  to_email?: string | null; appointment_id?: string | null;
}
export interface QueueRpc {
  claim(opts: { limit: number; appointmentId?: string; id?: string; fallbackInstance?: string }): Promise<ClaimedMessage[]>;
  finish(id: string, status: "sent" | "skipped" | "failed", providerId?: string, error?: string): Promise<string>;
}
export interface SendOutcome { id: string; kind: string; result: string; providerId?: string; providerStatus?: string; error?: string; email?: string }
export interface EmailDeps { provider: EmailProvider; policy: SendPolicy; business?: (businessId: string) => string; ics?: (m: ClaimedMessage) => Promise<string | undefined> }

/** Toma mensajes vencidos y los envía. Nunca envía a un número fuera de la política. */
export async function processQueue(rpc: QueueRpc, provider: WhatsAppProvider, policy: SendPolicy,
  opts: { limit?: number; appointmentId?: string; id?: string; fallbackInstance?: string } = {}, email?: EmailDeps): Promise<SendOutcome[]> {
  const rows = await rpc.claim({ limit: opts.limit ?? 20, appointmentId: opts.appointmentId, id: opts.id, fallbackInstance: opts.fallbackInstance });
  const out: SendOutcome[] = [];
  const emails = new Map<string, string | undefined>();
  for (const m of rows) {
    if (email && m.attempts <= 1) emails.set(m.id, await sendEmail(m, email));
    if (!allowedToSend(m.to_phone, policy)) {
      out.push({ id: m.id, kind: m.kind, result: await rpc.finish(m.id, "skipped", undefined, "not_in_allowlist") });
      continue;
    }
    if (!m.body?.trim()) { out.push({ id: m.id, kind: m.kind, result: await rpc.finish(m.id, "skipped", undefined, "empty_body") }); continue; }
    if (!m.instance_name) { out.push({ id: m.id, kind: m.kind, result: await rpc.finish(m.id, "failed", undefined, "no_connected_instance"), error: "no_connected_instance" }); continue; }
    if (provider.demo) { out.push({ id: m.id, kind: m.kind, result: await rpc.finish(m.id, "skipped", undefined, "demo_provider") }); continue; }
    try {
      const r = await provider.sendText(m.instance_name, digits(m.to_phone), m.body);
      out.push({ id: m.id, kind: m.kind, result: await rpc.finish(m.id, "sent", r.id), providerId: r.id, providerStatus: r.status });
    } catch (e) {
      const err = ((e as Error).message ?? "send_error").slice(0, 300);
      out.push({ id: m.id, kind: m.kind, result: await rpc.finish(m.id, "failed", undefined, err), error: err });
    }
  }
  for (let i = 0; i < out.length; i++) if (!out[i].email) out[i].email = emails.get(out[i].id);
  return out;
}

/** Email solo para confirmación y cancelación. Devuelve 'sent:<id>' | 'skipped' | 'failed:<err>' | undefined. */
async function sendEmail(m: ClaimedMessage, d: EmailDeps): Promise<string | undefined> {
  if (!m.to_email || !["confirmation", "cancellation"].includes(m.kind) || !m.body) return undefined;
  if (!allowedToSend(m.to_email, d.policy)) return "skipped";
  try {
    const ics = m.kind === "confirmation" && d.ics ? await d.ics(m) : undefined;
    const r = await d.provider.send({ to: m.to_email, subject: emailSubject(m.kind, d.business?.(m.business_id) ?? "la barbería"), text: m.body, ics });
    return `sent:${r.id}`;
  } catch (e) { return `failed:${((e as Error).message ?? "").slice(0, 120)}`; }
}
