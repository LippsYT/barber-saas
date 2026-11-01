import { NextResponse } from "next/server";

/** Tope de peticiones por clave en una ventana. En memoria: frena abusos simples por instancia; el tope fuerte va en el borde (Vercel Firewall). */
const hits = new Map<string, number[]>();
export function limited(key: string, max: number, windowMs = 60_000, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return recent.length > max;
}
export const clientIp = (req: Request) => (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "desconocida";

/** Rechaza un POST con cookie que venga de otro sitio (CSRF): el Origin tiene que ser el mismo host. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // fetch del mismo sitio sin Origin; la cookie es SameSite=Lax
  try { return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host")); } catch { return false; }
}

/** Respuesta lista para devolver si la petición no pasa el origen o el tope; null si todo bien. */
export function guard(req: Request, opts: { key: string; max: number; windowMs?: number; origin?: boolean }): NextResponse | null {
  if (opts.origin !== false && !sameOrigin(req)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  if (limited(`${opts.key}:${clientIp(req)}`, opts.max, opts.windowMs)) return NextResponse.json({ error: "Demasiadas peticiones. Espera un momento." }, { status: 429 });
  return null;
}
