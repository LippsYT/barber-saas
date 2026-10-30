/**
 * Seguridad de envío. WHATSAPP_SEND_ALLOWLIST = lista de E.164 separados por coma.
 * - Si está definida: solo esos números reciben; el resto queda 'skipped'.
 * - Si no está definida: en producción se envía a todos; fuera de producción NO se envía a nadie.
 */
export type SendPolicy = { mode: "all" } | { mode: "none" } | { mode: "list"; numbers: Set<string> };

export function digits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

export function sendPolicy(env: Record<string, string | undefined> = process.env): SendPolicy {
  return sendPolicyFor(env.WHATSAPP_SEND_ALLOWLIST, env);
}

/** Igual para email: los elementos se comparan en minúsculas. */
export function sendPolicyFor(rawList: string | undefined, env: Record<string, string | undefined>): SendPolicy {
  const raw = rawList?.trim();
  if (raw) {
    const numbers = new Set(raw.split(",").map(key).filter((d) => d.length >= 5));
    return numbers.size ? { mode: "list", numbers } : { mode: "none" };
  }
  return env.VERCEL_ENV === "production" ? { mode: "all" } : { mode: "none" };
}

/** Teléfono → dígitos; email → minúsculas. */
export function key(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s.includes("@") ? s.toLowerCase() : digits(s);
}

export function allowedToSend(target: string | null | undefined, policy: SendPolicy): boolean {
  const d = key(target);
  if (d.length < 5 || (!d.includes("@") && d.length < 8)) return false;
  if (policy.mode === "all") return true;
  if (policy.mode === "none") return false;
  return policy.numbers.has(d);
}
