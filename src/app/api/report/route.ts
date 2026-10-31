import { NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-server";
import { sendWeeklyReport } from "@/lib/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/** POST: manda ahora el informe de la última semana al correo de quien lo pide (dueño o admin). */
export async function POST() {
  let sb;
  try { sb = await supabaseFromCookies(); } catch { return fail(500, "Falta configurar Supabase."); }
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user?.email) return fail(401, "Entra a tu cuenta para continuar.");
  const { data: mem } = await sb.from("memberships").select("role, business:businesses(id, name, timezone, currency)").eq("user_id", auth.user.id).eq("active", true).limit(1);
  const row = mem?.[0] as { role?: string; business?: { id: string; name: string; timezone: string; currency: string } } | undefined;
  if (!row?.business) return fail(400, "Primero crea tu barbería.");
  if (row.role !== "owner" && row.role !== "admin") return fail(403, "Solo el dueño o un admin puede pedir el informe.");
  try {
    const r = await sendWeeklyReport({ business_id: row.business.id, name: row.business.name, timezone: row.business.timezone, currency: row.business.currency, owner_email: auth.user.email });
    return r === "sent" ? NextResponse.json({ sent: true, to: auth.user.email }) : fail(409, "El envío de email no está habilitado en este entorno.");
  } catch (e) {
    return fail(502, e instanceof Error ? e.message.slice(0, 160) : "No se pudo enviar el informe.");
  }
}
