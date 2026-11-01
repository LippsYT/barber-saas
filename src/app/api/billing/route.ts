import { NextResponse } from "next/server";
import { supabaseFromCookies } from "@/lib/supabase-server";
import { addonPriceId, addonsOfSubscription, billingReady, billingRpc, stripeClient } from "@/lib/billing";
import { addonOf, isAddonKey, keyFromLookup, withNeeds, type AddonKey } from "@/lib/addons";
import { appBaseUrl } from "@/lib/messaging/templates";
import { guard } from "@/lib/guard";

export const runtime = "nodejs";
const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/** POST { action: "checkout" | "portal" | "addon" }: devuelve { url } de Stripe para suscribirse o administrar el plan,
 *  o activa/quita un complemento ({ key, enable }) en la suscripción activa. Solo el dueño. */
export async function POST(req: Request) {
  const blocked = guard(req, { key: "billing", max: 30 });
  if (blocked) return blocked;
  let body: { action?: string; addons?: unknown[]; key?: unknown; enable?: boolean };
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
  const { data: sub } = await sb.from("subscriptions").select("stripe_customer_id, stripe_subscription_id, status").eq("business_id", row.business.id).maybeSingle();
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
      const picked = withNeeds((Array.isArray(body.addons) ? body.addons : []).filter((k): k is AddonKey => typeof k === "string" && isAddonKey(k)));
      const extra = await Promise.all(picked.map(async (k) => ({ price: await addonPriceId(stripe, k), quantity: 1 })));
      const s = await stripe.checkout.sessions.create({
        mode: "subscription", customer, client_reference_id: row.business.id,
        line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }, ...extra],
        subscription_data: { metadata: { business_id: row.business.id }, ...(trial > 0 && !sub?.stripe_subscription_id ? { trial_period_days: Math.min(Math.floor(trial), 90) } : {}) /* la prueba solo la primera vez */ },
        success_url: `${base}/app/suscripcion?ok=1`, cancel_url: `${base}/app/suscripcion`,
      });
      return NextResponse.json({ url: s.url });
    }
    if (body.action === "addon") {
      const key = String(body.key ?? "");
      if (!isAddonKey(key)) return fail(400, "Complemento desconocido.");
      if (!sub?.stripe_subscription_id || !["active", "trialing", "past_due"].includes(sub.status)) return fail(409, "Primero activa tu suscripción.");
      const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id as string);
      const has = addonsOfSubscription(current);
      // Reactivación necesita WhatsApp; al quitar WhatsApp se quita también lo que depende de él.
      const want = body.enable === false ? has.filter((k) => k !== key && !(key === "whatsapp" && addonOf(k)?.needs === "whatsapp")) : withNeeds([...has, key]);
      for (const k of want.filter((k) => !has.includes(k))) {
        await stripe.subscriptionItems.create({ subscription: current.id, price: await addonPriceId(stripe, k), quantity: 1, proration_behavior: "create_prorations" });
      }
      for (const k of has.filter((k) => !want.includes(k))) {
        const item = current.items.data.find((i) => keyFromLookup(i.price?.lookup_key) === k);
        if (item) await stripe.subscriptionItems.del(item.id, { proration_behavior: "create_prorations" });
      }
      const fresh = await stripe.subscriptions.retrieve(current.id);
      await billingRpc().sync(fresh);
      return NextResponse.json({ addons: addonsOfSubscription(fresh) });
    }
  } catch (e) {
    console.error("billing", e instanceof Error ? e.name : "error"); // sin el texto de Stripe: no se muestra al cliente
    return fail(502, "No se pudo hablar con Stripe. Intenta de nuevo en un momento.");
  }
  return fail(400, "Acción desconocida.");
}
