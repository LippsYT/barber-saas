import { NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-server";
import { getWhatsAppProvider } from "@/lib/whatsapp";
import { instanceNameFor, normalizePhone } from "@/lib/whatsapp/parse";
import { workerRpc } from "@/lib/workerRpc";
import { guard } from "@/lib/guard";

export const runtime = "nodejs";

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  const blocked = guard(req, { key: "whatsapp", max: 30 });
  if (blocked) return blocked;
  let body: { action?: string; phone?: string };
  try { body = await req.json(); } catch { return fail(400, "Pide un JSON válido."); }

  let sb;
  try { sb = await supabaseFromCookies(); } catch { return fail(500, "Falta configurar Supabase."); }
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail(401, "Entra a tu cuenta para conectar WhatsApp.");

  const { data: mem } = await sb.from("memberships").select("role, business:businesses(id, slug)").eq("user_id", auth.user.id).eq("active", true).limit(1);
  const row = mem?.[0] as { role?: string; business?: { id: string; slug: string } } | undefined;
  const biz = row?.business;
  if (!biz) return fail(400, "Primero crea tu barbería.");
  if (row?.role !== "owner" && row?.role !== "admin") return fail(403, "Solo el dueño o un admin puede conectar WhatsApp.");

  const provider = getWhatsAppProvider();
  const instance = instanceNameFor(biz.slug);

  if (body.action === "status") {
    const { data: link } = await sb.from("whatsapp_links").select("*").eq("business_id", biz.id).maybeSingle();
    if (!link) return NextResponse.json({ status: "disconnected", demo: provider.demo, provider: provider.id });
    let linkState: string | undefined;
    if (!link.demo && link.status === "pairing") {
      try {
        const state = await provider.connectionState(link.instance_name);
        linkState = state;
        if (state === "open") {
          // "Conectado" solo lo marca el servidor, después de preguntarle a Evolution (la base no deja que lo escriba el navegador).
          await workerRpc("wa")("wa_link_status", { p_business: biz.id, p_status: "connected" });
          return NextResponse.json({ status: "connected", demo: false, provider: "evolution", phone: link.phone });
        }
      } catch { linkState = "unreachable"; }
    }
    return NextResponse.json({
      status: link.status, demo: link.demo, provider: link.provider, phone: link.phone, pairingCode: link.status === "pairing" ? link.pairing_code : undefined, state: linkState,
    });
  }

  if (body.action === "demo-confirm") {
    const { data: link } = await sb.from("whatsapp_links").select("*").eq("business_id", biz.id).maybeSingle();
    if (!link?.demo) return fail(400, "Esto solo aplica en modo demo.");
    if (link.status !== "pairing") return fail(400, "Primero pide un código.");
    const { error } = await sb.rpc("wa_link_demo_confirm");
    if (error) return fail(400, "No se pudo guardar la conexión demo.");
    return NextResponse.json({ status: "connected", demo: true, provider: "mock" });
  }

  if (body.action === "start") {
    let phone: string;
    try { phone = normalizePhone(body.phone ?? ""); } catch { return fail(400, "Escribe el número con código de país, sin espacios. Ejemplo: 593999111222."); }
    try {
      await provider.createInstance(instance);
      const pairingCode = await provider.connectPairing(instance, phone);
      // El nombre de la instancia lo calcula la base a partir del slug: no se puede apuntar a la instancia de otro negocio.
      const { error } = await sb.rpc("wa_link_start", { p_phone: phone, p_code: pairingCode, p_provider: provider.id, p_demo: provider.demo });
      if (error) return fail(400, "No se pudo guardar el código. ¿Aplicaste la migración 0032?");
      return NextResponse.json({
        status: "pairing", pairingCode, demo: provider.demo, provider: provider.id, phone,
      });
    } catch {
      return fail(502, provider.demo
        ? "No se pudo armar el código demo."
        : "Evolution API no respondió. Revisa EVOLUTION_API_URL y que la instancia acepte emparejamiento.");
    }
  }

  return fail(400, "Acción desconocida.");
}
