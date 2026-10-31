"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const KEY = "pulso:splash";
const ease = [0.22, 1, 0.36, 1] as const;

/** Marca de Pulso: la caja azul aparece, la línea de pulso se dibuja y entra el nombre. */
export function SplashMark({ size = 96 }: { size?: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col items-center gap-5">
      <motion.svg viewBox="0 0 32 32" width={size} height={size} aria-hidden
        initial={reduce ? false : { scale: 0.4, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ duration: 0.6, ease }}>
        <rect width="32" height="32" rx="9" fill="#2F5BFF" />
        <motion.path d="M5.5 17.5h6.2l2.1-6.2 3.2 10.2 2.2-6h7.3" fill="none" stroke="#D6FF4A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeInOut", delay: 0.35 }} />
      </motion.svg>
      <motion.div className="font-display text-4xl font-extrabold uppercase leading-none tracking-tight text-white"
        initial={reduce ? false : { opacity: 0, y: 14, letterSpacing: "0.3em" }} animate={{ opacity: 1, y: 0, letterSpacing: "0em" }} transition={{ duration: 0.7, ease, delay: 0.9 }}>
        Pulso
      </motion.div>
    </div>
  );
}

/** Pantalla de entrada. Se ve una vez por sesión y solo cuando `ready` es verdadero. */
export function Splash({ ready }: { ready: boolean }) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { if (!sessionStorage.getItem(KEY)) { sessionStorage.setItem(KEY, "1"); if (!reduce) setShow(true); } } catch { /* sin storage: sin splash */ }
  }, [reduce]);
  useEffect(() => {
    if (!show || !ready) return;
    const t = setTimeout(() => setShow(false), 2000);
    return () => clearTimeout(t);
  }, [show, ready]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div key="splash" role="presentation" className="fixed inset-0 z-[100] grid place-items-center bg-[#070B14]"
          exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.45, ease }}>
          <SplashMark />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
