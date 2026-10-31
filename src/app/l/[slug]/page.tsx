import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { isReservedSlug } from "@/lib/reserved";
import { absoluteUrl, appBaseUrl } from "@/lib/messaging/templates";
import { PulseLinkPage, type LinkPageData } from "@/components/PulseLinkPage";

const VALID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
async function load(slug: string) {
  if (!VALID.test(slug) || isReservedSlug(slug)) return null;
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data } = await db.rpc("public_get_link_page", { p_slug: slug }).then((r) => r, () => ({ data: null }));
  return (data as LinkPageData | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return {};
  const title = d.business.name, description = d.headline || `Reserva en ${d.business.name}, ubicación y enlaces.`;
  const image = absoluteUrl(`/api/og/b/${slug}`);
  return { title, description, alternates: { canonical: `${appBaseUrl()}/l/${slug}` }, openGraph: { title, description, siteName: "Pulso", images: [{ url: image, width: 1200, height: 630, alt: title }] }, twitter: { card: "summary_large_image", title, description, images: [image] } };
}

export default async function L({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  return <PulseLinkPage data={d} />;
}
