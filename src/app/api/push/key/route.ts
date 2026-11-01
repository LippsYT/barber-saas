import { NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-server";
import { vapidKeys } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: la clave pública para suscribir el dispositivo. Solo con sesión; si no existe todavía, se crea. */
export async function GET() {
  let sb;
  try { sb = await supabaseFromCookies(); } catch { return NextResponse.json({ error: "Falta configurar Supabase." }, { status: 500 }); }
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Entra a tu cuenta para continuar." }, { status: 401 });
  try { return NextResponse.json({ publicKey: (await vapidKeys()).public }); }
  catch { return NextResponse.json({ error: "Las notificaciones todavía no están listas en el servidor." }, { status: 503 }); }
}
