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
  day_locked: "Este día ya está cerrado. No se puede cambiar.",
  invalid_day: "Esa fecha no se puede usar.",
  invalid_adjustment: "El ajuste deja el precio por debajo de cero.",
  already_attended: "Esta cita ya está cobrada.",
  appointment_closed: "Esta cita ya no se puede cambiar.",
  appointment_not_found: "No encontramos esa cita.",
  invalid_method: "Elige efectivo o transferencia.",
  description_required: "Escribe qué se pagó.",
  invalid_amount: "El monto no es válido.",
  draft_already_exists: "Ya hay una liquidación sin pagar para esta persona.",
  payout_not_approved: "La liquidación todavía no está lista para pagarse.",
  expense_over_limit: "El gasto supera el límite permitido para tu rol.",
  reason_required: "Escribe un motivo (mínimo 3 letras).",
  sale_not_paid: "Esta venta ya fue anulada.",
  invalid_phone: "Teléfono inválido.",
  invalid_name: "Escribe tu nombre.",
  too_many_requests: "Demasiadas reservas seguidas. Intenta más tarde.",
  "is invalid": "Ese correo no es válido o no se aceptan correos de ese dominio. Usa otro correo.",
  "not authorized": "Por ahora no se pueden crear cuentas con ese correo. Usa otro o contacta al soporte.",
  "Invalid login credentials": "Correo o contraseña incorrectos.",
  "Email not confirmed": "Tu correo aún no está confirmado. Revisa tu bandeja de entrada.",
  "User already registered": "Ya existe una cuenta con ese correo. Entra con tu contraseña.",
  "Password should be at least": "La contraseña debe tener al menos 6 caracteres.",
  "rate limit": "Demasiados intentos. Espera unos minutos y vuelve a intentar.",
  appointments_no_overlap: "El barbero ya tiene una cita en ese horario.",
};
export function errEs(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  for (const k of Object.keys(ERR)) if (m.includes(k)) return ERR[k];
  return m;
}
