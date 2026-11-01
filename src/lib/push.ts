import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { appBaseUrl } from "@/lib/messaging/templates";

/** Envío de notificaciones push desde el servidor. Las claves VAPID viven en la base (se crean solas la primera vez). */
function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, secret = process.env.CRON_SECRET;
  if (!url || !key || !secret) throw new Error("missing_env");
  return { client: createClient(url, key, { auth: { persistSession: false } }), secret };
}

export async function vapidKeys(): Promise<{ public: string; private: string }> {
  const { client, secret } = db();
  const read = async () => {
    const { data, error } = await client.rpc("push_vapid", { p_secret: secret });
    if (error) throw new Error(error.message);
    return data as { public: string; private: string } | null;
  };
  const found = await read();
  if (found) return found;
  const k = webpush.generateVAPIDKeys();
  const { error } = await client.rpc("push_vapid_set", { p_secret: secret, p_public: k.publicKey, p_private: k.privateKey });
  if (error) throw new Error(error.message);
  return (await read())!; // si dos peticiones crean a la vez, gana la primera y ambas leen la misma
}

type Item = { title: string; body: string; url: string; subs: { endpoint: string; p256dh: string; auth: string }[] };

/** Saca los avisos pendientes y los manda. Los dispositivos que ya no existen (404/410) se borran. */
export async function drainPush(): Promise<{ items: number; sent: number; pruned: number }> {
  const { client, secret } = db();
  const { data, error } = await client.rpc("push_claim", { p_secret: secret, p_limit: 50 });
  if (error) throw new Error(error.message);
  const items = (data ?? []) as Item[];
  if (!items.length) return { items: 0, sent: 0, pruned: 0 };
  const keys = await vapidKeys();
  const vapid = { subject: appBaseUrl() || "mailto:soporte@pulso.app", publicKey: keys.public, privateKey: keys.private };
  let sent = 0; const dead: string[] = [];
  for (const it of items) {
    await Promise.all(it.subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: it.title, body: it.body, url: it.url }), { vapidDetails: vapid, TTL: 3600, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint);
      }
    }));
  }
  let pruned = 0;
  if (dead.length) {
    const r = await client.rpc("push_prune", { p_secret: secret, p_endpoints: dead });
    pruned = Number(r.data ?? 0);
  }
  return { items: items.length, sent, pruned };
}
