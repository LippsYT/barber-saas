import type { Metadata } from "next";
import { Screens } from "@/components/captura/Screens";

export const metadata: Metadata = { robots: { index: false, follow: false }, title: "Vista previa" };

export default async function Page({ params }: { params: Promise<{ vista: string }> }) {
  const { vista } = await params;
  return <Screens vista={vista} />;
}
