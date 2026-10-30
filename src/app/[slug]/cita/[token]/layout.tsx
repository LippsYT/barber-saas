import type { Metadata } from "next";
import { loadCard } from "@/lib/ogCard";
import { absoluteUrl, appBaseUrl, fechaEs } from "@/lib/messaging/templates";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; token: string }> }): Promise<Metadata> {
  const { slug, token } = await params;
  const base = appBaseUrl();
  const pageUrl = `${base}/${slug}/cita/${token}`;
  const c = await loadCard(token).catch(() => null);
  const title = c ? `Tu cita en ${c.business}` : "Tu cita";
  const description = c ? `${fechaEs(c.starts_at, c.timezone)} · con ${c.barber}` : "Detalle de tu cita en Pulso.";
  const image = absoluteUrl(`/api/og/${token}`);
  const images = c ? [{ url: image, width: 1200, height: 630, alt: title }] : undefined;
  return {
    metadataBase: new URL(base),
    title,
    description,
    robots: { index: false },
    alternates: { canonical: pageUrl },
    openGraph: { title, description, url: pageUrl, siteName: "Pulso", type: "website", images },
    twitter: { card: "summary_large_image", title, description, images: images?.map((i) => i.url) },
  };
}
export default function L({ children }: { children: React.ReactNode }) { return children; }
