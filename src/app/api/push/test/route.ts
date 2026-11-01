import { NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-server";
import { drainPush } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST: manda un aviso de prueba a los dispositivos de quien lo pide. */
export async function POST() {
  let sb;
  try { sb = await supabaseFromCookies(); } catch { return NextResponse.json({ error: "Falta configurar Supabase." }, { status: 500 }); }
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Entra a tu cuenta para continuar." }, { status: 401 });
  const { error } = await sb.rpc("push_test");
  if (error) return NextResponse.json({ error: "No se pudo preparar el aviso." }, { status: 400 });
  try {
    const r = await drainPush();
    return r.sent > 0 ? NextResponse.json({ sent: r.sent }) : NextResponse.json({ error: "No llegó a ningún dispositivo. Activa las notificaciones en este celular e intenta de nuevo." }, { status: 409 });
  } catch { return NextResponse.json({ error: "No se pudo enviar el aviso." }, { status: 502 }); }
}
