import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const GRID = "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)";
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
type Cat = {
  business?: { name: string; address: string | null; hours?: { weekday: number; is_open: boolean; start: string; end: string }[] };
  barbers?: { name: string }[]; services?: { name: string; price: number }[];
};
const usd = (c: number) => `US$ ${(Number(c) / 100).toFixed(2)}`;

/** Pieza cuadrada vertical (1080×1350) para historias y publicaciones. ?kind=reservas | horario | servicios | equipo */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return new Response("not_found", { status: 404 });
  const kind = new URL(req.url).searchParams.get("kind") ?? "reservas";
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data } = await db.rpc("public_get_catalog", { p_slug: slug });
  const cat = data as Cat | null;
  if (!cat?.business) return new Response("not_found", { status: 404 });
  const b = cat.business;

  let title = "Reserva tu cita", lines: string[] = ["Elige barbero, servicio y horario", "Confirmación por WhatsApp"];
  if (kind === "horario") {
    title = "Nuestro horario";
    const h = [1, 2, 3, 4, 5, 6, 0].map((w) => b.hours?.find((x) => x.weekday === w)).map((x, i) => `${DAYS[[1, 2, 3, 4, 5, 6, 0][i]]}: ${x ? (x.is_open ? `${x.start} – ${x.end}` : "Cerrado") : "—"}`);
    lines = b.hours?.length ? h : ["Escríbenos para conocer el horario"];
  } else if (kind === "servicios") {
    title = "Servicios";
    lines = (cat.services ?? []).slice(0, 7).map((s) => `${s.name} · ${usd(s.price)}`);
  } else if (kind === "equipo") {
    title = "Nuestro equipo";
    lines = (cat.barbers ?? []).slice(0, 7).map((x) => x.name);
  }
  if (!lines.length) lines = ["Reserva online en nuestro enlace"];
  const nameSize = b.name.length > 22 ? 72 : b.name.length > 14 ? 90 : 108;

  const r = new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#2F5BFF", backgroundImage: GRID, backgroundSize: "54px 54px", color: "#FFFFFF", padding: 80, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#2F5BFF", fontSize: 34, fontWeight: 800 }}>P</div>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 2 }}>PULSO</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignSelf: "flex-start", background: "#D6FF4A", color: "#070B14", fontSize: nameSize, fontWeight: 800, lineHeight: 1.05, padding: "8px 30px", textTransform: "uppercase", letterSpacing: -2 }}>{b.name}</div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 800, marginTop: 40, textTransform: "uppercase" }}>{title}</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 24, gap: 12 }}>
          {lines.map((l, i) => <div key={i} style={{ display: "flex", fontSize: 40, color: "rgba(255,255,255,.92)" }}>{l}</div>)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignSelf: "flex-start", background: "#070B14", color: "#FFFFFF", fontSize: 34, fontWeight: 800, padding: "14px 30px", borderRadius: 999 }}>Reserva en el enlace de mi bio</div>
        {b.address ? <div style={{ display: "flex", fontSize: 30, color: "rgba(255,255,255,.85)" }}>{b.address}</div> : null}
      </div>
    </div>, { width: 1080, height: 1350 });
  r.headers.set("Cache-Control", "public, max-age=300");
  return r;
}
