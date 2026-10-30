import { Booking } from "@/components/Booking";
export default async function P({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <Booking slug={slug} />; }
