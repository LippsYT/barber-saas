"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
export function sb(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
    client = createBrowserClient(url, key);
  }
  return client;
}

/** Traduce códigos de error de las RPC a español claro. */
const ERR: Record<string, string> = {
  forbidden: "No tienes permiso para esta acción.",
  slug_taken: "Ese enlace ya está en uso, prueba otro.",
  slot_taken: "Ese horario acaba de ocuparse. Elige otro.",
  payments_mismatch: "Los pagos no suman el total a cobrar.",
  note_required: "Hay diferencia: escribe una nota explicando por qué.",
  session_closed: "Esta caja ya está cerrada.",
  session_already_open: "Ya hay una caja abierta.",
  expense_over_limit: "El gasto supera el límite permitido para tu rol.",
  reason_required: "Escribe un motivo (mínimo 3 letras).",
  sale_not_paid: "Esta venta ya fue anulada.",
  invalid_phone: "Teléfono inválido.",
  invalid_name: "Escribe tu nombre.",
  too_many_requests: "Demasiadas reservas seguidas. Intenta más tarde.",
  appointments_no_overlap: "El barbero ya tiene una cita en ese horario.",
};
export function errEs(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  for (const k of Object.keys(ERR)) if (m.includes(k)) return ERR[k];
  return m;
}
