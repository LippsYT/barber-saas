import { createClient } from "@supabase/supabase-js";
import type { CalEvent } from "./calendar";

export interface CitaCal { id: string; starts_at: string; ends_at: string; status: string; business_name: string; address: string | null; slug: string; timezone: string; member_name: string; services?: string }

export async function loadCita(token: string): Promise<CitaCal | null> {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const [{ data }, { data: bk }] = await Promise.all([db.rpc("public_booking_calendar", { p_token: token }), db.rpc("public_get_booking", { p_token: token })]);
  if (!data) return null;
  const items = (bk as { items?: { name: string }[] } | null)?.items ?? [];
  return { ...(data as CitaCal), services: items.map((i) => i.name).join(", ") || undefined };
}

export function citaEvent(c: CitaCal, origin: string, token: string): CalEvent {
  const url = `${origin}/${c.slug}/cita/${token}`;
  return {
    uid: c.id, start: c.starts_at, end: c.ends_at, timezone: c.timezone,
    title: `${c.services ? c.services + " · " : "Cita · "}${c.business_name}`,
    location: c.address ? `${c.business_name}, ${c.address}` : c.business_name,
    description: `Con ${c.member_name}.\nVer o cancelar: ${url}`,
    url,
  };
}
