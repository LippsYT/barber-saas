/** Email (confirmación y cancelación). Brevo si hay BREVO_API_KEY; si no Resend (RESEND_API_KEY); si no, mock. */
import { sendPolicyFor } from "./allowlist";

export interface EmailMessage { to: string; subject: string; text: string; html?: string; ics?: string }
export interface EmailProvider { readonly id: "brevo" | "resend" | "mock"; send(m: EmailMessage): Promise<{ id: string }> }

export function createResendProvider(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): EmailProvider {
  return {
    id: "resend",
    async send(m) {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from, to: [m.to], subject: m.subject, text: m.text, html: m.html,
          attachments: m.ics ? [{ filename: "cita.ics", content: Buffer.from(m.ics).toString("base64"), content_type: "text/calendar" }] : undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok || !j.id) throw new Error(`resend_${res.status}: ${(j.message ?? "").slice(0, 150)}`);
      return { id: j.id };
    },
  };
}

/** "Nombre <a@b.com>" o "a@b.com" -> { name?, email } */
export function parseFrom(from: string): { name?: string; email: string } {
  const m = from.trim().match(/^\s*"?([^"<]*?)"?\s*<\s*([^>\s]+)\s*>\s*$/);
  if (m) return m[1].trim() ? { name: m[1].trim(), email: m[2] } : { email: m[2] };
  return { email: from.trim() };
}

export function createBrevoProvider(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): EmailProvider {
  const sender = parseFrom(from);
  return {
    id: "brevo",
    async send(m) {
      const res = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender, to: [{ email: m.to }], subject: m.subject, textContent: m.text,
          ...(m.html ? { htmlContent: m.html } : {}),
          ...(m.ics ? { attachment: [{ name: "cita.ics", content: Buffer.from(m.ics).toString("base64") }] } : {}),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string };
      if (!res.ok || !j.messageId) throw new Error(`brevo_${res.status}: ${(j.message ?? "").slice(0, 150)}`);
      return { id: j.messageId };
    },
  };
}

export function createMockEmailProvider(): EmailProvider & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return { id: "mock", sent, async send(m) { sent.push(m); return { id: `MOCK-EMAIL-${sent.length}` }; } };
}

export function getEmailProvider(env: Record<string, string | undefined> = process.env): EmailProvider {
  const brevo = env.BREVO_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (brevo && from) return createBrevoProvider(brevo, from);
  const key = env.RESEND_API_KEY?.trim();
  return key ? createResendProvider(key, from || "Pulso <onboarding@resend.dev>") : createMockEmailProvider();
}

export const emailPolicy = (env: Record<string, string | undefined> = process.env) => sendPolicyFor(env.EMAIL_SEND_ALLOWLIST, env);

export function emailSubject(kind: string, business: string) {
  return kind === "cancellation" ? `Tu cita en ${business} fue cancelada` : `Tu cita en ${business} está confirmada`;
}
