import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
const display = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
export const metadata: Metadata = { title: "Barbería — agenda y caja", description: "Agenda, reservas por barbero, comisiones automáticas y una caja que se explica sola." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0e0c0a" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="es" className={`${display.variable} ${sans.variable}`}><body>{children}</body></html>);
}
