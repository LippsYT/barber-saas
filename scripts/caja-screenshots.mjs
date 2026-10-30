import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const shots = [
  ["caja-hoy", "caja-hoy"],
  ["caja-cierre", "cerrar-caja"],
  ["caja-reportes", "reportes"],
  ["caja-adelantos", "adelantos-liquidacion"],
  ["cita-atendida", "marcar-cita-atendida"],
];

await mkdir("/opt/cursor/artifacts", { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
for (const [vista, name] of shots) {
  await page.goto(`${base}/captura/${vista}`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const nav = document.querySelector("nav");
    const canvas = document.querySelector(".app-canvas");
    if (nav && canvas) {
      nav.style.position = "relative";
      canvas.appendChild(nav);
    }
  });
  await page.screenshot({ path: `/opt/cursor/artifacts/${name}.png`, fullPage: true });
  console.log(name);
}
await browser.close();
