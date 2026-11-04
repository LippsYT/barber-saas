import "./globals.css";
import type { Metadata, Viewport } from "next";
import { CANONICAL_BASE } from "@/lib/messaging/templates";
import { Barlow_Condensed, Outfit } from "next/font/google";

const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display", display: "swap" });
const sans = Outfit({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

import splashImages from "@/lib/splashImages.json";
// Ícono cuadrado. No hay opengraph-image en la raíz: esa ruta choca con [slug].
const ogImage = { url: `${CANONICAL_BASE}/icon-512.png`, width: 512, height: 512, alt: "Pulso" };
export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_BASE),
  title: "Pulso — agenda, caja y reservas",
  description: "Agenda, reservas por barbero, comisiones y una caja al centavo. En la moneda de tu país, desde el celular.",
  applicationName: "Pulso",
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }] },
  appleWebApp: { capable: true, title: "Pulso", statusBarStyle: "black-translucent", startupImage: splashImages },
  openGraph: { images: [ogImage] },
  twitter: { card: "summary", images: [ogImage] },
  other: { "apple-mobile-web-app-capable": "yes" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#070B14" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="es" className={`${display.variable} ${sans.variable}`}><body>{children}</body></html>);
}
