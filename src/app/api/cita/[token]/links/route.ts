import { NextResponse } from "next/server";
import { googleCalendarUrl } from "@/lib/calendar";
import { citaEvent, loadCita } from "@/lib/citaCalendar";
import { saveToWalletUrl } from "@/lib/gwallet";

export const runtime = "nodejs";
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const c = await loadCita(token);
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const origin = new URL(req.url).origin;
  const ev = citaEvent(c, origin, token);
  const wallet = saveToWalletUrl({ id: c.id, business: c.business_name, startsAt: c.starts_at, timezone: c.timezone, service: c.services, barber: c.member_name, address: c.address, url: ev.url! }, origin);
  return NextResponse.json({ google: googleCalendarUrl(ev), wallet }, { headers: { "Cache-Control": "no-store" } });
}
