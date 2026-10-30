import { NextResponse } from "next/server";
import { citaEvent, loadCita } from "@/lib/citaCalendar";
import { createApplePass } from "@/lib/applePass";

export const runtime = "nodejs";
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const key = process.env.WALLETWALLET_API_KEY;
  if (!key) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const { token } = await ctx.params;
  const c = await loadCita(token);
  if (!c || !["reserved", "confirmed"].includes(c.status)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const ev = citaEvent(c, new URL(req.url).origin, token);
  try {
    const { pkpass } = await createApplePass({ id: c.id, business: c.business_name, startsAt: c.starts_at, timezone: c.timezone, service: c.services, barber: c.member_name, address: c.address, url: ev.url! }, key);
    return new Response(Buffer.from(pkpass), { headers: { "Content-Type": "application/vnd.apple.pkpass", "Content-Disposition": 'attachment; filename="cita.pkpass"', "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
