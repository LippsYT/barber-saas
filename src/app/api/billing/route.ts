import { NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-server";
import { billingReady, billingRpc, stripeClient } from "@/lib/billing";
import { appBaseUrl } from "@/lib/messaging/templates";

export const runtime = "nodejs";
const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/** POST { action: "checkout" | "portal" }: devuelve { url } de Stripe para suscribirse o administrar el plan. Solo el dueño. */
export async function POST(req: Request) {
  let body: { action?: string };
  try { body = await req.json(); } catch { return fail(400, "Pide un JSON válido."); }
  if (!billingReady()) return fail(503, "Los pagos todavía no están configurados.");

  let sb;
  try { sb = await supabaseFromCookies(); } catch { return fail(500, "Falta configurar Supabase."); }
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail(401, "Entra a tu cuenta para continuar.");
  const { data: mem } = await sb.from("memberships").select("role, business:businesses(id, name)").eq("user_id", auth.user.id).eq("active", true).limit(1);
  const row = mem?.[0] as { role?: string; business?: { id: string; name: string } } | undefined;
  if (!row?.business) return fail(400, "Primero crea tu barbería.");
  if (row.role !== "owner") return fail(403, "Solo el dueño puede administrar la suscripción.");

  const stripe = stripeClient()!;
  const base = appBaseUrl();
  const { data: sub } = await sb.from("subscriptions").select("stripe_customer_id, status").eq("business_id", row.business.id).maybeSingle();
  let customer = sub?.stripe_customer_id as string | undefined;

  try {
    if (body.action === "portal") {
      if (!customer) return fail(400, "Todavía no tienes una suscripción.");
      const s = await stripe.billingPortal.sessions.create({ customer, return_url: `${base}/app/suscripcion` });
      return NextResponse.json({ url: s.url });
    }
    if (body.action === "checkout") {
      if (sub?.status === "active" || sub?.status === "trialing") return fail(409, "Tu suscripción ya está activa.");
      if (!customer) {
        const c = await stripe.customers.create({ name: row.business.name, email: auth.user.email ?? undefined, metadata: { business_id: row.business.id } });
        customer = c.id;
        await billingRpc().linkCustomer(row.business.id, customer);
      }
      const trial = Number(process.env.STRIPE_TRIAL_DAYS);
      const s = await stripe.checkout.sessions.create({
        mode: "subscription", customer, client_reference_id: row.business.id,
        line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
        subscription_data: { metadata: { business_id: row.business.id }, ...(trial > 0 ? { trial_period_days: Math.min(Math.floor(trial), 90) } : {}) },
        success_url: `${base}/app/suscripcion?ok=1`, cancel_url: `${base}/app/suscripcion`,
      });
      return NextResponse.json({ url: s.url });
    }
  } catch (e) {
    return fail(502, e instanceof Error ? `Stripe: ${e.message}` : "No se pudo hablar con Stripe.");
  }
  return fail(400, "Acción desconocida.");
}
