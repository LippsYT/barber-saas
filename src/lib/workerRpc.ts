import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

/** Dominios de las RPC que solo debe llamar el servidor. Cada uno tiene su propio token derivado del CRON_SECRET. */
export type WorkerScope = "messages" | "billing" | "report" | "push" | "wa";

/** Token de un dominio: sha256("dominio:secreto"). La base lo recalcula con el secreto del vault (migración 0032). */
export const scopedToken = (scope: WorkerScope, secret: string) => createHash("sha256").update(`${scope}:${secret}`).digest("hex");

/**
 * Llama una RPC del worker con el cliente anon y el token de su dominio.
 * Requiere la migración 0032: la base ya no acepta el secreto crudo.
 */
export function workerRpc(scope: WorkerScope) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, secret = process.env.CRON_SECRET;
  if (!url || !key || !secret) throw new Error("missing_env");
  const db = createClient(url, key, { auth: { persistSession: false } });
  return (fn: string, args: Record<string, unknown> = {}) => db.rpc(fn, { ...args, p_secret: scopedToken(scope, secret) });
}
