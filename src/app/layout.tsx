import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Outfit } from "next/font/google";

const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display", display: "swap" });
const sans = Outfit({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Pulso — agenda, caja y reservas",
  description: "Agenda, reservas por barbero, comisiones y una caja al centavo. En dólares, desde el celular.",
  applicationName: "Pulso",
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }] },
  appleWebApp: { capable: true, title: "Pulso", statusBarStyle: "black-translucent" },
  other: { "mobile-web-app-capable": "yes" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#070B14" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="es" className={`${display.variable} ${sans.variable}`}><body>{children}</body></html>);
}
