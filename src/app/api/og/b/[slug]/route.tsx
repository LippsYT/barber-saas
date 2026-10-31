import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { OG_SIZE } from "@/lib/ogCard";

export const runtime = "nodejs";

const GRID = "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)";
type Cat = { business?: { name: string; address: string | null }; barbers?: { name: string }[] };

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return new Response("not_found", { status: 404 });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: cat } = await db.rpc("public_get_catalog", { p_slug: slug });
  const { business: data, barbers } = (cat as Cat | null) ?? {};
  if (!data) return new Response("not_found", { status: 404 });
  const names = (barbers ?? []).slice(0, 3).map((b) => b.name.trim().split(/\s+/)[0]).join(" · ");
  const size = data.name.length > 22 ? 84 : data.name.length > 14 ? 104 : 124;
  const r = new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#2F5BFF", backgroundImage: GRID, backgroundSize: "40px 40px", color: "#FFFFFF", padding: 64, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#2F5BFF", fontSize: 30, fontWeight: 800 }}>P</div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 2 }}>PULSO</div>
        </div>
        <div style={{ display: "flex", background: "#D6FF4A", color: "#070B14", fontSize: 26, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", padding: "10px 24px", borderRadius: 999 }}>Reserva online</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignSelf: "flex-start", background: "#D6FF4A", color: "#070B14", fontSize: size, fontWeight: 800, lineHeight: 1.05, padding: "6px 28px", textTransform: "uppercase", letterSpacing: -2 }}>{data.name}</div>
        <div style={{ display: "flex", fontSize: 38, marginTop: 28, color: "rgba(255,255,255,.9)" }}>{data.address ?? "Elige barbero, servicio y horario"}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12 }}>
          {["Barbero", "Servicio", "Horario"].map((t, i) => (
            <div key={t} style={{ display: "flex", background: "rgba(7,11,20,.55)", borderRadius: 999, padding: "10px 22px", fontSize: 26, fontWeight: 700 }}>{`${i + 1} · ${t}`}</div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#FFFFFF" }}>{names ? `Con ${names}` : "Confirmación por WhatsApp"}</div>
      </div>
    </div>, OG_SIZE);
  r.headers.set("Cache-Control", "public, max-age=3600");
  return r;
}
