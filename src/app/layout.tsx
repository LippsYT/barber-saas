import "./globals.css";
import type { Metadata, Viewport } from "next";
export const metadata: Metadata = { title: "Barbería — agenda y caja", description: "Agenda, reservas y caja transparente para barberías" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="es"><body><div className="mx-auto max-w-2xl p-4">{children}</div></body></html>);
}
