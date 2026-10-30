import { notFound } from "next/navigation";
import { Booking } from "@/components/Booking";
import { isReservedSlug } from "@/lib/reserved";
export default async function P({ params }: { params: Promise<{ slug: string; barber: string }> }) {
  const { slug, barber } = await params; if (isReservedSlug(slug) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) notFound();
  return <Booking slug={slug} barberSlug={barber} />;
}
