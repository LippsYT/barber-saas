// Genera los íconos PWA / iOS desde la marca de Pulso (Logo.tsx: Mark). Uso: node scripts/icons.mjs
import sharp from "sharp";
const svg = (inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="1024" height="1024">
<rect width="32" height="32" fill="#2F5BFF"/>
<g transform="translate(16 16) scale(${inner}) translate(-16 -16.4)">
<path d="M5.5 17.5h6.2l2.1-6.2 3.2 10.2 2.2-6h7.3" fill="none" stroke="#D6FF4A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`);
const out = [["public/apple-touch-icon.png", 180, 0.92], ["public/icon-192.png", 192, 0.92], ["public/icon-512.png", 512, 0.92], ["public/icon-maskable-512.png", 512, 0.68]];
for (const [f, size, k] of out) await sharp(svg(k)).resize(size, size).flatten({ background: "#2F5BFF" }).removeAlpha().png().toFile(f);
