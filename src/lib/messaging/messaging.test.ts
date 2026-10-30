import { describe, expect, it } from "vitest";
import { generateKeyPairSync, createVerify } from "crypto";
import { allowedToSend, sendPolicy, sendPolicyFor } from "./allowlist";
import { processQueue, type ClaimedMessage, type QueueRpc } from "./sender";
import { createMockProvider } from "@/lib/whatsapp/mock";
import { createEvolutionProvider, parseSendResult } from "@/lib/whatsapp/evolution";
import { createMockEmailProvider } from "./email";
import { CANONICAL_BASE, appBaseUrl, cancellationText, citaText, fechaEs, isPreviewHost, plainText, reactivationSettings, reactivationText, withBase } from "./templates";
import { buildIcs, googleCalendarUrl } from "@/lib/calendar";
import { walletPayload, signWalletJwt, saveToWalletUrl } from "@/lib/gwallet";

const OWNER = "+5491157604074";

describe("allowlist", () => {
  it("con lista: solo esos números", () => {
    const p = sendPolicy({ WHATSAPP_SEND_ALLOWLIST: OWNER, VERCEL_ENV: "preview" });
    expect(allowedToSend("+54 9 11 5760-4074", p)).toBe(true);
    expect(allowedToSend("+593999111222", p)).toBe(false);
  });
  it("sin lista fuera de producción: nadie", () => {
    expect(allowedToSend(OWNER, sendPolicy({ VERCEL_ENV: "preview" }))).toBe(false);
    expect(allowedToSend(OWNER, sendPolicy({}))).toBe(false);
  });
  it("sin lista en producción: todos", () => {
    expect(allowedToSend("+593999111222", sendPolicy({ VERCEL_ENV: "production" }))).toBe(true);
  });
  it("email: compara en minúsculas", () => {
    const p = sendPolicyFor("Dueno@Example.com", { VERCEL_ENV: "preview" });
    expect(allowedToSend("dueno@example.com", p)).toBe(true);
    expect(allowedToSend("otro@example.com", p)).toBe(false);
  });
});

function fakeRpc(rows: ClaimedMessage[]) {
  const finished: Record<string, string> = {};
  const rpc: QueueRpc = {
    async claim() { return rows; },
    async finish(id, status, providerId, err) { finished[id] = `${status}${providerId ? ":" + providerId : ""}${err ? ":" + err : ""}`; return status; },
  };
  return { rpc, finished };
}
const row = (o: Partial<ClaimedMessage>): ClaimedMessage => ({ id: "m1", business_id: "b", kind: "confirmation", to_phone: OWNER, body: "hola", attempts: 1, instance_name: "pulso-x", ...o });

describe("cola", () => {
  const live = () => { const p = createMockProvider(); return Object.assign(p, { demo: false }); };
  it("envía al permitido y salta al resto", async () => {
    const { rpc, finished } = fakeRpc([row({ id: "a" }), row({ id: "b", to_phone: "+593999111222" })]);
    const prov = live();
    const out = await processQueue(rpc, prov, sendPolicy({ WHATSAPP_SEND_ALLOWLIST: OWNER }));
    expect(out.map((o) => o.result)).toEqual(["sent", "skipped"]);
    expect(prov.sent).toHaveLength(1);
    expect(prov.sent[0].number).toBe("5491157604074");
    expect(finished.b).toContain("not_in_allowlist");
  });
  it("sin instancia conectada: failed (reintento lo decide SQL)", async () => {
    const { rpc } = fakeRpc([row({ instance_name: null })]);
    expect((await processQueue(rpc, live(), sendPolicy({ WHATSAPP_SEND_ALLOWLIST: OWNER })))[0].result).toBe("failed");
  });
  it("proveedor demo nunca envía", async () => {
    const { rpc } = fakeRpc([row({})]);
    expect((await processQueue(rpc, createMockProvider(), sendPolicy({ WHATSAPP_SEND_ALLOWLIST: OWNER })))[0].result).toBe("skipped");
  });
  it("email solo en confirmación/cancelación, primer intento y con allowlist", async () => {
    const { rpc } = fakeRpc([row({ id: "a", to_email: "yo@x.com" }), row({ id: "b", kind: "reminder", to_email: "yo@x.com" }), row({ id: "c", to_email: "otro@x.com" })]);
    const em = createMockEmailProvider();
    const out = await processQueue(rpc, live(), sendPolicy({ WHATSAPP_SEND_ALLOWLIST: OWNER }), {}, { provider: em, policy: sendPolicyFor("yo@x.com", {}) });
    expect(out.map((o) => o.email)).toEqual(["sent:MOCK-EMAIL-1", undefined, "skipped"]);
    expect(em.sent).toHaveLength(1);
  });
});

describe("evolution sendText", () => {
  it("POST /message/sendText/{instance} con apikey", async () => {
    let call: { url: string; init: RequestInit } | null = null;
    const p = createEvolutionProvider({ baseUrl: "https://evo.test/", apiKey: "k", fetchImpl: (async (url: string, init: RequestInit) => { call = { url, init }; return new Response(JSON.stringify({ key: { id: "3EB0ABC" }, status: "PENDING" }), { status: 201 }); }) as unknown as typeof fetch });
    expect(await p.sendText("pulso-x", "5491157604074", "hola")).toEqual({ id: "3EB0ABC", status: "PENDING" });
    expect(call!.url).toBe("https://evo.test/message/sendText/pulso-x");
    expect((call!.init.headers as Record<string, string>).apikey).toBe("k");
    expect(JSON.parse(String(call!.init.body))).toEqual({ number: "5491157604074", text: "hola" });
  });
  it("sin id es error", () => { expect(() => parseSendResult({})).toThrow(); });
});

describe("plantillas", () => {
  it("reactivación con formato", () => {
    expect(reactivationText("Felippe Barreto", 25, "Lumos", "https://x/lumos")).toBe("💈 *Lumos*\n\nHola Felippe, ya pasaron 25 días desde tu último corte. ¿Agendamos el próximo?\n\nReserva aquí: https://x/lumos");
  });
  it("fecha legible y textos de cita", () => {
    expect(fechaEs("2026-10-31T15:10:00Z", "America/Guayaquil")).toBe("Sábado 31 de octubre, 10:10 a. m.");
    expect(fechaEs("2026-11-01T00:30:00Z", "America/Guayaquil")).toBe("Sábado 31 de octubre, 7:30 p. m.");
    const c = { name: "Ana Pérez", business: "B", barber: "C", startsAt: "2026-10-31T15:10:00Z", timezone: "America/Guayaquil", services: "Corte", total: 1000, address: "Calle 1", shortToken: "abc123XYZ" };
    expect(citaText("confirmation", c)).toBe("✅ *¡Cita confirmada, Ana!*\n\n💈 *B*\n📅 Sábado 31 de octubre, 10:10 a. m.\n✂️ Corte · US$ 10,00\n👤 Con C\n📍 Calle 1\n\nVer o cancelar tu cita: {{BASE}}/c/abc123XYZ");
    expect(cancellationText("A", "B", c.startsAt, c.timezone, "b")).toContain("fue cancelada");
    expect(withBase("x {{BASE}}/c/1", "https://h")).toBe("x https://h/c/1");
    expect(plainText("*hola* x")).toBe("hola x");
    expect(appBaseUrl({ VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "barber-saas-git-preview-lippsyts-projects.vercel.app", VERCEL_URL: "barber-saas-abc.vercel.app" })).toBe(CANONICAL_BASE);
    expect(appBaseUrl({})).toBe(CANONICAL_BASE);
    expect(appBaseUrl({ APP_BASE_URL: "https://z.com/" })).toBe("https://z.com");
    expect(appBaseUrl({ APP_BASE_URL: "https://barber-saas-git-preview-lippsyts-projects.vercel.app" })).toBe(CANONICAL_BASE);
    expect(isPreviewHost(CANONICAL_BASE)).toBe(false);
    expect(withBase("Reserva aquí: https://barber-saas-git-preview-lippsyts-projects.vercel.app/lumos", CANONICAL_BASE)).toBe(`Reserva aquí: ${CANONICAL_BASE}/lumos`);
    expect(withBase("Si quieres, reserva otra: /lumos", CANONICAL_BASE)).toBe(`Si quieres, reserva otra: ${CANONICAL_BASE}/lumos`);
  });
  it("sender: reemplaza {{BASE}} y manda tarjeta como imagen en la confirmación", async () => {
    const sent: { kind: string; caption?: string; text?: string }[] = [];
    const p = { ...createMockProvider(), demo: false,
      async sendText(_i: string, _n: string, text: string) { sent.push({ kind: "text", text }); return { id: "T" }; },
      async sendMedia(_i: string, _n: string, _png: string, caption: string) { sent.push({ kind: "media", caption }); return { id: "M" }; } };
    const msgs: ClaimedMessage[] = [
      { id: "1", business_id: "b", kind: "confirmation", to_phone: "+5491157604074", body: "ok {{BASE}}/c/xyz", attempts: 1, instance_name: "i", short_token: "xyz", media: "og" },
      { id: "2", business_id: "b", kind: "reminder", to_phone: "+5491157604074", body: "r {{BASE}}/c/xyz", attempts: 1, instance_name: "i", short_token: "xyz" },
    ];
    const rpc: QueueRpc = { async claim() { return msgs; }, async finish() { return "sent"; } };
    await processQueue(rpc, p, sendPolicyFor("+5491157604074", {}), { baseUrl: "https://h", card: async () => "UE5H" });
    expect(sent).toEqual([{ kind: "media", caption: "ok https://h/c/xyz" }, { kind: "text", text: "r https://h/c/xyz" }]);
  });
  it("ajustes: default OFF y 25 días", () => {
    expect(reactivationSettings(null)).toEqual({ enabled: false, days: 25 });
    expect(reactivationSettings({ reactivation: { enabled: true, days: 40 } })).toEqual({ enabled: true, days: 40 });
    expect(reactivationSettings({ reactivation: { enabled: true, days: 2 } }).days).toBe(25);
  });
});

describe("calendario", () => {
  const ev = { uid: "abc", start: "2026-10-31T15:10:00Z", end: "2026-10-31T15:40:00Z", title: "Corte, barba · House Davidson", location: "House Davidson; Quito", description: "Con Andrés.\nVer o cancelar: https://x/c/t", url: "https://x/c/t", timezone: "America/Guayaquil" };
  it(".ics válido", () => {
    const ics = buildIcs(ev, new Date("2026-10-30T00:00:00Z"));
    expect(ics).toContain("DTSTART:20261031T151000Z");
    expect(ics).toContain("SUMMARY:Corte\\, barba · House Davidson");
    expect(ics).toContain("LOCATION:House Davidson\\; Quito");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("Google Calendar", () => {
    const u = new URL(googleCalendarUrl(ev));
    expect(u.searchParams.get("dates")).toBe("20261031T151000Z/20261031T154000Z");
    expect(u.searchParams.get("ctz")).toBe("America/Guayaquil");
  });
});

describe("google wallet", () => {
  const appt = { id: "a-1", business: "House Davidson", startsAt: "2026-10-31T15:10:00Z", timezone: "America/Guayaquil", service: "Corte", barber: "Andrés", url: "https://x/c/t" };
  it("payload", () => {
    const p = walletPayload("338800", "sa@p.iam.gserviceaccount.com", appt, "https://x");
    expect(p).toMatchObject({ iss: "sa@p.iam.gserviceaccount.com", aud: "google", typ: "savetowallet", origins: ["https://x"] });
    const o = p.payload.genericObjects[0];
    expect(o.id).toBe("338800.cita_a-1"); expect(o.classId).toBe("338800.pulso_cita");
    expect(o.textModulesData.map((t) => t.header)).toEqual(["Servicio", "Barbero"]);
  });
  it("JWT RS256 verificable; sin env no hay link", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const jwt = signWalletJwt({ a: 1 }, pem);
    const [h, b, s] = jwt.split(".");
    const v = createVerify("RSA-SHA256"); v.update(`${h}.${b}`);
    expect(v.verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
    expect(saveToWalletUrl(appt, "https://x", {})).toBeNull();
    const url = saveToWalletUrl(appt, "https://x", { GOOGLE_WALLET_ISSUER_ID: "1", GOOGLE_WALLET_SA_KEY: JSON.stringify({ client_email: "e", private_key: pem }) });
    expect(url).toMatch(/^https:\/\/pay\.google\.com\/gp\/v\/save\//);
  });
});
