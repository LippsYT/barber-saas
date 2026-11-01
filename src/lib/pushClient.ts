"use client";
import { sb } from "@/lib/supabase";

/** Notificaciones push en el navegador: soporte, permiso, alta y baja del dispositivo. */
export type PushState = "unsupported" | "needs-install" | "blocked" | "off" | "on";

const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const b64ToBytes = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const bytesToB64 = (b: ArrayBuffer | null) => (b ? btoa(String.fromCharCode(...new Uint8Array(b))) : "");

export async function registerWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register("/sw.js"); } catch { return null; }
}

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  // En iPhone solo funciona con la app instalada en la pantalla de inicio.
  if (isIos() && !standalone()) return "needs-install";
  if (!("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await registerWorker();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** Pide permiso, se suscribe y guarda el dispositivo. Devuelve un texto de error o null si salió bien. */
export async function enablePush(): Promise<string | null> {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "No diste permiso. Puedes cambiarlo en los ajustes del navegador o del celular.";
    const reg = await registerWorker();
    if (!reg) return "Este navegador no permite notificaciones.";
    const k = await fetch("/api/push/key").then((r) => r.json()).catch(() => ({}));
    if (!k.publicKey) return k.error || "No se pudo preparar las notificaciones. Intenta de nuevo.";
    const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(k.publicKey) });
    const { error } = await sb().rpc("push_save", { p_endpoint: sub.endpoint, p_p256dh: bytesToB64(sub.getKey("p256dh")), p_auth: bytesToB64(sub.getKey("auth")), p_ua: navigator.userAgent.slice(0, 200) });
    return error ? "No se pudo guardar este dispositivo. Intenta de nuevo." : null;
  } catch { return "No se pudieron activar las notificaciones en este dispositivo."; }
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await sb().rpc("push_remove", { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}
