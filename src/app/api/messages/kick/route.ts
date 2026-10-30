import { NextResponse } from "next/server";
import { runQueue } from "@/lib/messaging/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Envío inmediato tras reservar o cancelar. Público, pero solo procesa mensajes ya vencidos
 * de esa cita (los mismos que el cron mandaría en ≤3 min). Respeta la allowlist.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  let appointmentId: string | null = typeof body.appointmentId === "string" && /^[0-9a-f-]{36}$/i.test(body.appointmentId) ? body.appointmentId : null;
  if (!appointmentId && typeof body.token === "string" && body.token.length >= 16) {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data } = await db.rpc("public_appointment_id", { p_token: body.token });
    appointmentId = typeof data === "string" ? data : null;
  }
  if (!appointmentId) return NextResponse.json({ error: "appointmentId" }, { status: 400 });
  try {
    const r = await runQueue({ limit: 5, appointmentId });
    return NextResponse.json({ processed: r.length, results: r.map(({ kind, result }) => ({ kind, result })) });
  } catch {
    return NextResponse.json({ processed: 0 }, { status: 202 });
  }
}
