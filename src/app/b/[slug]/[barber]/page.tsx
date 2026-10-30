import { Booking } from "@/components/Booking";
export default async function P({ params }: { params: Promise<{ slug: string; barber: string }> }) { const { slug, barber } = await params; return <Booking slug={slug} barberSlug={barber} />; }
