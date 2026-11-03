import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { workerRpc } from "@/lib/workerRpc";
import { guard } from "@/lib/guard";
import { addonsTotal, BASE_PRICE, isAddonKey } from "@/lib/addons";
import { billingCurrency, planPrice } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/** Comparación en tiempo constante (se comparan los hashes: mismo largo siempre). */
const sameKey = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/**
 * GET /api/admin/metrics?since=<ISO>
 * Para tu panel de SaaS (llamada de servidor a servidor). Pide `Authorization: Bearer <METRICS_API_KEY>`.
 * Devuelve registros, pruebas, suscritos, ingresos y un feed `events` (registros y pagos desde `since`, por defecto 7 días)
 * con ids estables (`signup:<id>`, `payment:<factura>`) para avisar solo de lo nuevo. No incluye correos ni datos de clientes.
 */
export async function GET(req: Request) {
  const blocked = guard(req, { key: "metrics", max: 60 });
  if (blocked) return blocked;
  const key = process.env.METRICS_API_KEY?.trim();
  if (!key) return fail(503, "no_configurado");
  // Una clave corta es adivinable: no se acepta. Se dice distinto para que se note que el valor quedó mal copiado.
  if (key.length < 32) return fail(503, "clave_muy_corta");
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!given || !sameKey(given, key)) return fail(401, "no_autorizado");

  const q = new URL(req.url).searchParams.get("since");
  const max = Date.now() - 90 * 86400000;
  let since = q ? Date.parse(q) : NaN;
  if (!Number.isFinite(since)) since = Date.now() - 7 * 86400000;
  since = Math.max(since, max);

  let data: Record<string, unknown> | null = null;
  try {
    const { data: d, error } = await workerRpc("metrics")("admin_metrics", { p_since: new Date(since).toISOString() });
    if (error) throw new Error(error.code ?? "rpc");
    data = d as Record<string, unknown>;
  } catch (e) {
    console.error(JSON.stringify({ evt: "metrics_error", detail: e instanceof Error ? e.message.slice(0, 120) : "unknown" }));
    return fail(502, "no_disponible");
  }

  // MRR estimado por moneda de cobro: plan + complementos de cada suscripción activa, al precio fijo de esa moneda.
  const mrr: Record<string, number> = {};
  for (const s of (data?.active_subs as { currency: string; addons: string[] }[] | undefined) ?? []) {
    const cur = billingCurrency(s.currency);
    mrr[cur] = (mrr[cur] ?? 0) + planPrice(BASE_PRICE + addonsTotal((s.addons ?? []).filter(isAddonKey)), cur);
  }
  const { active_subs: _omit, ...rest } = data ?? {};
  void _omit;
  return NextResponse.json({ ...rest, mrr, generated_at: new Date().toISOString(), amounts: "centavos de cada moneda" }, { headers: { "Cache-Control": "no-store" } });
}
