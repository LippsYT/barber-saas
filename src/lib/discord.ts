export interface DiscordField { name: string; value: string }
export interface DiscordEvent { title: string; color: number; fields: DiscordField[] }

export const DISCORD_COLORS = { signup: 0x22c55e, payment: 0xfacc15, online: 0x3b82f6 } as const;

/** Solo se acepta un webhook de Discord: si la variable queda mal pegada, no se manda nada a otro sitio. */
export function discordWebhookUrl(raw = process.env.DISCORD_WEBHOOK_URL): string | null {
  const url = raw?.trim();
  if (!url) return null;
  try {
    const u = new URL(url);
    const ok = u.protocol === "https:" && (u.hostname === "discord.com" || u.hostname === "discordapp.com") && u.pathname.startsWith("/api/webhooks/");
    return ok ? u.toString() : null;
  } catch { return null; }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Avisa a tu canal de Discord. Nunca lanza: un fallo de Discord no debe romper un registro ni un cobro.
 * Sin DISCORD_WEBHOOK_URL no hace nada.
 */
export async function notifyDiscord(ev: DiscordEvent, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const url = discordWebhookUrl();
  if (!url) return false;
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(4000),
      body: JSON.stringify({
        username: "Pulso",
        // Nada de @everyone ni menciones: el texto lo escriben los usuarios (nombre del negocio).
        allowed_mentions: { parse: [] },
        embeds: [{
          title: clip(ev.title, 250),
          color: ev.color,
          fields: ev.fields.slice(0, 10).map((f) => ({ name: clip(f.name, 250), value: clip(f.value || "—", 1000), inline: true })),
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    if (!res.ok) console.error(JSON.stringify({ evt: "discord_error", status: res.status }));
    return res.ok;
  } catch (e) {
    console.error(JSON.stringify({ evt: "discord_error", name: e instanceof Error ? e.name : "unknown" }));
    return false;
  }
}
