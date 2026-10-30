import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { fechaEs, usd } from "@/lib/messaging/templates";

export interface CardData { business: string; barber: string; starts_at: string; timezone: string; status?: string; address?: string | null; services?: string | null; total?: number | null }
export const OG_SIZE = { width: 1200, height: 630 };

export async function loadCard(token: string): Promise<CardData | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !/^[A-Za-z0-9]{6,128}$/.test(token)) return null;
  const { data } = await createClient(url, key, { auth: { persistSession: false } }).rpc("public_short_card", { p_short: token });
  return (data as CardData | null) ?? null;
}

export function cardImage(c: CardData) {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#070B14", color: "#F4F6FB", padding: 64, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#2F5BFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#D6FF4A", fontSize: 28, fontWeight: 800 }}>P</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 1 }}>PULSO</div>
        </div>
        <div style={{ fontSize: 24, letterSpacing: 4, color: "#D6FF4A", textTransform: "uppercase" }}>{c.status === "cancelled" ? "Cancelada" : "Tu cita"}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.02 }}>{c.business}</div>
        <div style={{ fontSize: 40, marginTop: 18 }}>{fechaEs(c.starts_at, c.timezone)}</div>
        {c.services ? <div style={{ fontSize: 32, marginTop: 10, display: "flex" }}>{`${c.services} · ${usd(Number(c.total ?? 0))}`}</div> : null}
        <div style={{ fontSize: 32, marginTop: 8, color: "#C8C2B6", display: "flex" }}>{`Con ${c.barber}`}</div>
      </div>
      <div style={{ display: "flex", fontSize: 26, color: "#9AA3B8" }}>{c.address ?? ""}</div>
    </div>,
    OG_SIZE,
  );
}

/** PNG en base64 para enviar por WhatsApp (sin depender de que la URL sea pública). */
export async function renderCardPng(token: string): Promise<string | undefined> {
  const c = await loadCard(token); if (!c) return undefined;
  return Buffer.from(await cardImage(c).arrayBuffer()).toString("base64");
}
