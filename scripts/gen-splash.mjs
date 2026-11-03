/** Genera las imágenes de inicio de iOS (public/splash/*.png): fondo oscuro con la marca de Pulso. Se corre a mano: `node scripts/gen-splash.mjs`. */
import sharp from "sharp";
import { writeFileSync } from "node:fs";

// [ancho CSS, alto CSS, factor de píxeles]
export const DEVICES = [
  [440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3],
  [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2],
];
const mark = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}"><rect width="32" height="32" rx="9" fill="#2F5BFF"/><path d="M5.5 17.5h6.2l2.1-6.2 3.2 10.2 2.2-6h7.3" fill="none" stroke="#D6FF4A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const list = [];
for (const [w, h, r] of DEVICES) {
  const W = w * r, H = h * r, size = 96 * r;
  const name = `${W}x${H}.png`;
  // La marca queda un poco arriba del centro, igual que en la pantalla de entrada de la app (marca + nombre centrados).
  const top = Math.round(H / 2 - size / 2 - 28 * r);
  await sharp({ create: { width: W, height: H, channels: 3, background: "#070B14" } })
    .composite([{ input: Buffer.from(mark(size)), left: Math.round(W / 2 - size / 2), top }])
    .png({ compressionLevel: 9 }).toFile(`public/splash/${name}`);
  list.push({ url: `/splash/${name}`, media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)` });
}
writeFileSync("src/lib/splashImages.json", JSON.stringify(list, null, 2) + "\n");
console.log(list.length, "imágenes");
