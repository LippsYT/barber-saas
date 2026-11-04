import { NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-server";
import { guard } from "@/lib/guard";
import { DISCORD_COLORS, notifyDiscord } from "@/lib/discord";

export const runtime = "nodejs";

const ok = () => NextResponse.json({ ok: true });

/**
 * POST { type: "signup" | "online" } — avisa a Discord de un negocio nuevo o de alguien que entró.
 * Solo con sesión iniciada; los datos salen de la base, nunca del cuerpo de la petición.
 */
export async function POST(req: Request) {
  const blocked = guard(req, { key: "notify", max: 20 });
  if (blocked) return blocked;
  let type: unknown;
  try { type = ((await req.json()) as { type?: unknown }).type; } catch { return NextResponse.json({ error: "json" }, { status: 400 }); }
  if (type !== "signup" && type !== "online") return NextResponse.json({ error: "tipo" }, { status: 400 });

  let sb;
  try { sb = await supabaseFromCookies(); } catch { return ok(); }
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "sin_sesion" }, { status: 401 });

  const { data: mem } = await sb.from("memberships").select("role, business:businesses(name, slug, country, currency, created_at, trial_ends_at)").eq("user_id", auth.user.id).eq("active", true).limit(1);
  const row = mem?.[0] as unknown as { role?: string; business?: { name: string; slug: string; country: string | null; currency: string | null; created_at: string; trial_ends_at: string | null } } | undefined;
  const biz = row?.business;
  if (!biz) return ok();

  const who = [{ name: "Correo", value: auth.user.email ?? "—" }, { name: "Barbería", value: biz.name }, { name: "País", value: biz.country ?? "—" }];
  if (type === "signup") {
    // Solo un negocio recién creado: así este aviso no se puede repetir para uno viejo.
    if (Date.now() - Date.parse(biz.created_at) > 15 * 60_000) return ok();
    const days = biz.trial_ends_at ? Math.max(0, Math.ceil((Date.parse(biz.trial_ends_at) - Date.now()) / 86400000)) : null;
    await notifyDiscord({ title: "🆕 Nuevo registro", color: DISCORD_COLORS.signup, fields: [...who, { name: "Moneda", value: biz.currency ?? "—" }, { name: "Prueba", value: days === null ? "—" : `${days} días` }, { name: "Enlace", value: `/${biz.slug}` }] });
  } else {
    await notifyDiscord({ title: "🟢 En línea", color: DISCORD_COLORS.online, fields: [...who, { name: "Rol", value: row?.role ?? "—" }] });
  }
  return ok();
}
