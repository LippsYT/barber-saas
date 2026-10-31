/** Mismos textos que en SQL (0019). Sirven para la vista previa en Ajustes y para tests. {{BASE}} lo reemplaza el sender. */
export const REACTIVATION_DEFAULT_DAYS = 25;
/** URL pública de producción. Nunca usar VERCEL_URL ni la URL de una rama. */
export const CANONICAL_BASE = "https://barber-saas-chi-five.vercel.app";
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const first = (n: string) => n.trim().split(/\s+/)[0] ?? n;

/** "Sábado 31 de octubre, 10:10 a. m." en la zona indicada. */
export function fechaEs(iso: string, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  const h = Number(p.hour) % 24;
  return `${DIAS[wd]} ${Number(p.day)} de ${MESES[Number(p.month) - 1]}, ${((h + 11) % 12) + 1}:${p.minute} ${h < 12 ? "a. m." : "p. m."}`;
}
/** n en centavos. */
export const usd = (cents: number) => `US$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

export interface CitaMsg { name: string; business: string; barber: string; startsAt: string; timezone: string; services?: string; total?: number; address?: string | null; shortToken: string }
export function citaText(kind: "confirmation" | "reminder24" | "reminder2", c: CitaMsg, base = "{{BASE}}") {
  const n = first(c.name);
  const head = kind === "confirmation" ? `✅ *¡Cita confirmada, ${n}!*` : kind === "reminder24" ? `⏰ *Recordatorio:* ${n}, mañana tienes cita.` : `⏰ *${n}, tu cita es en 2 horas.*`;
  const lines = [`💈 *${c.business}*`, `📅 ${fechaEs(c.startsAt, c.timezone)}`];
  if (c.services) lines.push(`✂️ ${c.services} · ${usd(c.total ?? 0)}`);
  lines.push(`👤 Con ${c.barber}`);
  if (c.address) lines.push(`📍 ${c.address}`);
  return `${head}\n\n${lines.join("\n")}\n\nVer o cancelar tu cita: ${base}/c/${c.shortToken}`;
}
export function cancellationText(name: string, business: string, startsAt: string, timezone: string, slug: string, base = "{{BASE}}") {
  return `❌ *Cita cancelada*\n\nHola ${first(name)}, tu cita en *${business}* del ${fechaEs(startsAt, timezone)} fue cancelada.\n\nSi quieres, reserva otra: ${base}/${slug}`;
}
export function reactivationText(name: string, days: number, business: string, link: string) {
  return `💈 *${business}*\n\nHola ${first(name)}, ya pasaron ${days} días desde tu último corte. ¿Agendamos el próximo?\n\nReserva aquí: ${link}`;
}

function absolute(v: string) {
  return (v.startsWith("http") ? v : `https://${v}`).replace(/\/+$/, "");
}
/** Host de un deploy de Vercel que no es el alias de producción. */
export function isPreviewHost(url: string) {
  try {
    const host = new URL(absolute(url)).host;
    return host.endsWith(".vercel.app") && host.startsWith("barber-saas") && host !== "barber-saas-chi-five.vercel.app";
  } catch { return false; }
}
/**
 * URL base absoluta, sin / final.
 * Prefiere APP_BASE_URL. Si falta, o si apunta a un deploy de preview/rama, usa la URL de producción.
 * No lee VERCEL_URL, VERCEL_BRANCH_URL ni VERCEL_PROJECT_PRODUCTION_URL.
 */
export function appBaseUrl(env: Record<string, string | undefined> = process.env) {
  const raw = env.APP_BASE_URL?.trim();
  if (raw) {
    const abs = absolute(raw);
    if (!isPreviewHost(abs)) return abs;
  }
  return CANONICAL_BASE;
}
export function absoluteUrl(path: string, env: Record<string, string | undefined> = process.env) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = appBaseUrl(env);
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
/** Sustituye {{BASE}} y cualquier host de preview ya guardado en el cuerpo. */
export function withBase(body: string, base: string) {
  const canonical = (base && !isPreviewHost(base) ? base : CANONICAL_BASE).replace(/\/+$/, "");
  return body
    .replaceAll("{{BASE}}", canonical)
    .replace(/https?:\/\/barber-saas[a-z0-9.-]*\.vercel\.app/gi, canonical)
    .replace(/((?:aquí|acá|otra):\s*)\/(?!\/)/gi, `$1${canonical}/`);
}
/** WhatsApp → texto plano para email. */
export const plainText = (body: string) => body.replace(/\*([^*\n]+)\*/g, "$1");
export function reactivationSettings(settings: unknown): { enabled: boolean; days: number } {
  const r = (settings as { reactivation?: { enabled?: unknown; days?: unknown } } | null)?.reactivation;
  const days = Number(r?.days);
  return { enabled: r?.enabled === true, days: Number.isInteger(days) && days >= 7 && days <= 365 ? days : REACTIVATION_DEFAULT_DAYS };
}
