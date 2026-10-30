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
  const gold = "#C9A35C";
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(135deg,#0B0F17 0%,#1A2130 100%)", color: "#F4EDE0", padding: 64, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 28, letterSpacing: 6, color: gold, textTransform: "uppercase" }}>{c.status === "cancelled" ? "Cita cancelada" : "Tu cita"}</div>
        <div style={{ fontSize: 76, fontWeight: 700, marginTop: 8, lineHeight: 1.05 }}>{c.business}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 52, fontWeight: 700 }}>{fechaEs(c.starts_at, c.timezone)}</div>
        {c.services ? <div style={{ fontSize: 36, display: "flex" }}>{`${c.services} · ${usd(Number(c.total ?? 0))}`}</div> : null}
        <div style={{ fontSize: 36, color: "#C8C2B6", display: "flex" }}>{`Con ${c.barber}`}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#8E8A82" }}>
        <div style={{ display: "flex" }}>{c.address ?? ""}</div>
        <div style={{ color: gold, display: "flex" }}>Pulso</div>
      </div>
    </div>,
    OG_SIZE,
  );
}

/** PNG en base64 para enviar por WhatsApp (sin depender de que la URL sea pública). */
export async function renderCardPng(token: string): Promise<string | undefined> {
  const c = await loadCard(token); if (!c) return undefined;
  return Buffer.from(await cardImage(c).arrayBuffer()).toString("base64");
}
