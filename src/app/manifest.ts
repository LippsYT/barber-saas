import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pulso",
    short_name: "Pulso",
    description: "Agenda, reservas y caja para tu barbería.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#070B14",
    theme_color: "#070B14",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
