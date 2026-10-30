import { notFound } from "next/navigation";
import { Booking } from "@/components/Booking";
import { isReservedSlug } from "@/lib/reserved";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { absoluteUrl, appBaseUrl } from "@/lib/messaging/templates";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (isReservedSlug(slug) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return {};
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data } = await db.rpc("public_get_catalog", { p_slug: slug }).then((r) => r, () => ({ data: null }));
  const name = (data as { business?: { name?: string } } | null)?.business?.name;
  if (!name) return {};
  const title = `Reserva en ${name}`, description = "Elige barbero, servicio y horario. Confirmación por WhatsApp.";
  const pageUrl = `${appBaseUrl()}/${slug}`;
  const image = absoluteUrl(`/api/og/b/${slug}`);
  const images = [{ url: image, width: 1200, height: 630, alt: title }];
  return { title, description, alternates: { canonical: pageUrl }, openGraph: { title, description, url: pageUrl, siteName: "Pulso", images }, twitter: { card: "summary_large_image", title, description, images: [image] } };
}
export default async function P({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; if (isReservedSlug(slug) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) notFound();
  return <Booking slug={slug} />;
}
