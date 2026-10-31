import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { reportRpc, sendWeeklyReport } from "@/lib/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (secret.length < 32 || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/** Cron semanal (vercel.json): manda el informe en PDF a cada dueño que lo activó. */
async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const targets = await reportRpc().targets();
    const results: { business: string; result: string }[] = [];
    for (const t of targets) {
      try { results.push({ business: t.name, result: await sendWeeklyReport(t) }); }
      catch (e) { results.push({ business: t.name, result: `failed: ${(e as Error).message.slice(0, 120)}` }); }
    }
    return NextResponse.json({ processed: results.length, results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
export const GET = handle;
export const POST = handle;
