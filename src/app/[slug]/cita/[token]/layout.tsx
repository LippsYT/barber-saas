import type { Metadata } from "next";
import { loadCard } from "@/lib/ogCard";
import { fechaEs } from "@/lib/messaging/templates";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const c = await loadCard(token).catch(() => null);
  if (!c) return { title: "Tu cita" };
  const title = `Tu cita en ${c.business}`;
  const description = `${fechaEs(c.starts_at, c.timezone)} · con ${c.barber}`;
  const images = [{ url: `/api/og/${token}`, width: 1200, height: 630 }];
  return { title, description, robots: { index: false }, openGraph: { title, description, images }, twitter: { card: "summary_large_image", title, description, images } };
}
export default function L({ children }: { children: React.ReactNode }) { return children; }
