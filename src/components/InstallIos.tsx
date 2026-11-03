"use client";
import { useEffect, useState } from "react";
import { PlusSquare, Share, X } from "lucide-react";

const KEY = "pulso_install_ios_off";
const DAYS = 14;
const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** En iPhone no hay aviso automático de «instalar» como en Android: se explica cómo agregar Pulso a la pantalla de inicio. */
export function InstallIos() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!isIos() || standalone()) return;
    try { const t = Number(localStorage.getItem(KEY)); if (t && Date.now() - t < DAYS * 86400000) return; } catch { /* sin almacenamiento: se muestra */ }
    const id = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(id);
  }, []);
  if (!show) return null;
  const hide = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignorar */ } setShow(false); };
  return (
    <div role="dialog" aria-label="Instalar Pulso" className="fixed inset-x-3 bottom-3 z-[60] rounded-3xl bg-ink p-4 text-white shadow-2xl ring-1 ring-white/10" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
      <button aria-label="Cerrar" className="absolute right-3 top-3 p-1 text-white/60" onClick={hide}><X className="h-4 w-4" /></button>
      <div className="flex items-center gap-3">
        <img src="/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 rounded-xl" />
        <div className="min-w-0 pr-5">
          <div className="text-base font-extrabold">Instala Pulso en tu iPhone</div>
          <p className="text-xs text-white/70">Ábrelo como una app, a pantalla completa y con avisos de tus reservas.</p>
        </div>
      </div>
      <ol className="mt-3 space-y-2 text-sm">
        <li className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10"><Share className="h-4 w-4" /></span>Toca <b>Compartir</b> en la barra de Safari.</li>
        <li className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10"><PlusSquare className="h-4 w-4" /></span>Elige <b>Agregar a inicio</b> y toca <b>Agregar</b>.</li>
      </ol>
    </div>
  );
}
