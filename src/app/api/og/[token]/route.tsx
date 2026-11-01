import { guard } from "@/lib/guard";
import { cardImage, loadCard } from "@/lib/ogCard";

export const runtime = "nodejs";
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const blocked = guard(_req, { key: "og", max: 120, origin: false });
  if (blocked) return blocked;
  const { token } = await ctx.params;
  const c = await loadCard(token);
  if (!c) return new Response("not_found", { status: 404 });
  const r = cardImage(c);
  r.headers.set("Cache-Control", "public, max-age=300");
  return r;
}
