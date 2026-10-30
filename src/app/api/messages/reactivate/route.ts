import { NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-server";
import { runQueue } from "@/lib/messaging/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Botón «Enviar recordatorio de regreso»: encola (RPC valida dueño/admin) y envía ya. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.clientId !== "string") return NextResponse.json({ error: "Falta el cliente." }, { status: 400 });
  const sb = await supabaseFromCookies();
  const { data: id, error } = await sb.rpc("enqueue_reactivation_now", { p_client: body.clientId });
  if (error) return NextResponse.json({ error: error.message.includes("forbidden") ? "No tienes permiso." : error.message.includes("no_phone") ? "El cliente no tiene teléfono." : "No se pudo preparar el mensaje." }, { status: 400 });
  const [r] = await runQueue({ id: String(id), limit: 1 });
  const result = r?.result ?? "pending";
  const msg = result === "sent" ? "Mensaje enviado." : result === "skipped" ? "No se envió: el número no está permitido en este entorno." : result === "retry" ? "WhatsApp falló; lo reintentamos en unos minutos." : "No se pudo enviar.";
  return NextResponse.json({ result, message: msg, providerId: r?.providerId }, { status: result === "sent" || result === "skipped" || result === "retry" ? 200 : 502 });
}
