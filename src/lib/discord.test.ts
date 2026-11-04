import { afterEach, describe, expect, it, vi } from "vitest";
import { discordWebhookUrl, notifyDiscord } from "./discord";

const GOOD = "https://discord.com/api/webhooks/123/abc";

describe("discord", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("solo acepta webhooks https de discord", () => {
    expect(discordWebhookUrl(GOOD)).toBe(GOOD);
    expect(discordWebhookUrl("http://discord.com/api/webhooks/1/a")).toBeNull();
    expect(discordWebhookUrl("https://evil.example/api/webhooks/1/a")).toBeNull();
    expect(discordWebhookUrl("https://discord.com/otra/ruta")).toBeNull();
    expect(discordWebhookUrl("")).toBeNull();
    expect(discordWebhookUrl(undefined)).toBeNull();
  });

  it("sin variable no manda nada", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", "");
    const f = vi.fn();
    expect(await notifyDiscord({ title: "x", color: 1, fields: [] }, f as unknown as typeof fetch)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("manda un embed sin menciones y recorta textos largos", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", GOOD);
    let sent: { allowed_mentions: unknown; embeds: { fields: { value: string }[] }[] } | null = null;
    const f = (async (_u: unknown, init?: RequestInit) => { sent = JSON.parse(String(init?.body)); return new Response(null, { status: 204 }); }) as typeof fetch;
    const ok = await notifyDiscord({ title: "@everyone", color: 1, fields: [{ name: "n", value: "x".repeat(5000) }] }, f);
    expect(ok).toBe(true);
    expect(sent!.allowed_mentions).toEqual({ parse: [] });
    expect(sent!.embeds[0].fields[0].value.length).toBeLessThanOrEqual(1000);
  });

  it("si Discord falla, no lanza", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", GOOD);
    const boom = (async () => { throw new Error("red"); }) as typeof fetch;
    await expect(notifyDiscord({ title: "x", color: 1, fields: [] }, boom)).resolves.toBe(false);
  });
});
