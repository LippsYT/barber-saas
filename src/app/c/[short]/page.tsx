import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/** Link corto de WhatsApp: /c/<short_token> → página de la cita. */
export default async function Short({ params }: { params: Promise<{ short: string }> }) {
  const { short } = await params;
  if (!/^[A-Za-z0-9]{6,16}$/.test(short)) notFound();
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data } = await db.rpc("public_short_lookup", { p_short: short });
  const d = data as { slug: string; manage_token: string } | null;
  if (!d) notFound();
  redirect(`/${d.slug}/cita/${d.manage_token}`);
}
