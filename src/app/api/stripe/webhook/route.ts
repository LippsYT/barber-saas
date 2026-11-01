import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { billingRpc, stripeClient } from "@/lib/billing";

export const runtime = "nodejs";

/** Webhook de Stripe. Verifica la firma sobre el cuerpo crudo y sincroniza el estado de la suscripción. */
export async function POST(req: Request) {
  const stripe = stripeClient(), secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) return NextResponse.json({ error: "no_configurado" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "sin_firma" }, { status: 400 });

  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await req.text(), signature, secret); }
  catch { return NextResponse.json({ error: "firma_invalida" }, { status: 400 }); }

  try {
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      // Se pide el estado actual a Stripe: un aviso viejo que llega tarde no puede reactivar una suscripción que ya se canceló.
      const sub = event.data.object as Stripe.Subscription;
      const fresh = await stripe.subscriptions.retrieve(sub.id).catch(() => null);
      await billingRpc().sync(fresh ?? sub);
    } else if (event.type === "customer.subscription.deleted") {
      await billingRpc().sync(event.data.object as Stripe.Subscription);
    } else if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode === "subscription" && typeof s.subscription === "string") await billingRpc().sync(await stripe.subscriptions.retrieve(s.subscription));
    }
  } catch (e) {
    // 500 hace que Stripe reintente el evento.
    return NextResponse.json({ error: "error" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
