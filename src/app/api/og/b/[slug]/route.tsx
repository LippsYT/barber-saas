import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { OG_SIZE } from "@/lib/ogCard";

export const runtime = "nodejs";
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return new Response("not_found", { status: 404 });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: cat } = await db.rpc("public_get_catalog", { p_slug: slug });
  const data = (cat as { business?: { name: string; address: string | null } } | null)?.business;
  if (!data) return new Response("not_found", { status: 404 });
  const r = new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", background: "linear-gradient(135deg,#0B0F17 0%,#1A2130 100%)", color: "#F4EDE0", padding: 72 }}>
      <div style={{ fontSize: 30, letterSpacing: 6, color: "#C9A35C", textTransform: "uppercase" }}>Reserva online</div>
      <div style={{ fontSize: 92, fontWeight: 700, marginTop: 10 }}>{data.name}</div>
      <div style={{ fontSize: 34, color: "#C8C2B6", marginTop: 18, display: "flex" }}>{data.address ?? "Elige barbero, servicio y horario"}</div>
    </div>, OG_SIZE);
  r.headers.set("Cache-Control", "public, max-age=3600");
  return r;
}
