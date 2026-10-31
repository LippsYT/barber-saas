import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

/** Stripe del servidor. Sin STRIPE_SECRET_KEY la suscripción queda desactivada y la pantalla lo dice. */
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return key ? new Stripe(key) : null;
}
export const billingReady = () => Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_PRICE_ID?.trim());

/** RPC de facturación con el cliente anon + CRON_SECRET (se valida en SQL contra vault, como la cola de mensajes). */
export function billingRpc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, secret = process.env.CRON_SECRET;
  if (!url || !key || !secret) throw new Error("missing_env");
  const db = createClient(url, key, { auth: { persistSession: false } });
  return {
    async linkCustomer(business: string, customer: string) {
      const { error } = await db.rpc("billing_link_customer", { p_secret: secret, p_business: business, p_customer: customer });
      if (error) throw new Error(error.message);
    },
    async sync(sub: Stripe.Subscription) {
      const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      // Las versiones nuevas de la API del periodo viven en el ítem; las viejas, en la suscripción.
      const end = (sub as unknown as { current_period_end?: number }).current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
      const iso = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString() : null);
      const { data, error } = await db.rpc("billing_sync", { p_secret: secret, p_customer: customer, p_subscription: sub.id, p_status: sub.status,
        p_period_end: iso(end), p_trial_end: iso(sub.trial_end), p_cancel: sub.cancel_at_period_end });
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
  };
}
