import { buildIcs } from "@/lib/calendar";
import { appBaseUrl } from "@/lib/messaging/templates";
import { citaEvent, loadCita } from "@/lib/citaCalendar";

export const runtime = "nodejs";
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const c = await loadCita(token);
  if (!c) return new Response("No encontrada", { status: 404 });
  const ics = buildIcs(citaEvent(c, appBaseUrl(), token));
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="cita.ics"', "Cache-Control": "no-store" } });
}
