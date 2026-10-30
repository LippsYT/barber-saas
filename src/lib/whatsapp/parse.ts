/** Código de emparejamiento: 8 caracteres, sin guion. */
export function normalizePairingCode(raw: string): string {
  const s = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (s.length < 8) throw new Error("pairing_code_short");
  return s.slice(0, 8);
}

export function normalizePhone(input: string): string {
  const d = input.replace(/\D/g, "");
  if (d.length < 8 || d.length > 15) throw new Error("invalid_phone");
  return d;
}

/** Hash corto y estable para el modo demo. No es un secreto. */
export function mockPairingCode(instanceName: string, phone: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = 2166136261;
  const src = `${instanceName}|${phone}`;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  let x = h >>> 0;
  for (let i = 0; i < 8; i++) {
    out += alphabet[x % alphabet.length];
    x = Math.imul(x, 1664525) + 1013904223;
    x >>>= 0;
  }
  return out;
}

export function parseEvolutionConnect(body: unknown): string {
  const o = body as { pairingCode?: unknown; pairing_code?: unknown };
  const raw = o?.pairingCode ?? o?.pairing_code;
  if (typeof raw !== "string" || !raw.trim()) throw new Error("pairing_code_missing");
  return normalizePairingCode(raw);
}

export type LinkState = "close" | "connecting" | "open";

export function parseEvolutionState(body: unknown): LinkState {
  const o = body as { instance?: { state?: unknown }; state?: unknown };
  const state = String(o?.instance?.state ?? o?.state ?? "close").toLowerCase();
  if (state === "open" || state === "connected") return "open";
  if (state === "connecting") return "connecting";
  return "close";
}

export function instanceNameFor(slug: string): string {
  const base = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const name = `pulso-${base || "barberia"}`;
  return name.slice(0, 40);
}
