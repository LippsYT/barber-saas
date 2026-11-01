import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { drainPush } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (secret.length < 32 || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/** La base (pg_net) llama aquí cuando hay avisos por mandar. Protegido con CRON_SECRET. */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  try { return NextResponse.json(await drainPush()); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 }); }
}
