/** Email (confirmación y cancelación). Resend si hay RESEND_API_KEY; si no, mock. */
import { sendPolicyFor } from "./allowlist";

export interface EmailMessage { to: string; subject: string; text: string; html?: string; ics?: string }
export interface EmailProvider { readonly id: "resend" | "mock"; send(m: EmailMessage): Promise<{ id: string }> }

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

export function createMockEmailProvider(): EmailProvider & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return { id: "mock", sent, async send(m) { sent.push(m); return { id: `MOCK-EMAIL-${sent.length}` }; } };
}

export function getEmailProvider(env: Record<string, string | undefined> = process.env): EmailProvider {
  const key = env.RESEND_API_KEY?.trim();
  return key ? createResendProvider(key, env.EMAIL_FROM?.trim() || "Pulso <onboarding@resend.dev>") : createMockEmailProvider();
}

export const emailPolicy = (env: Record<string, string | undefined> = process.env) => sendPolicyFor(env.EMAIL_SEND_ALLOWLIST, env);

export function emailSubject(kind: string, business: string) {
  return kind === "cancellation" ? `Tu cita en ${business} fue cancelada` : `Tu cita en ${business} está confirmada`;
}
