"use client";
import { useEffect, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { Phone } from "@/components/brand/Phone";

/** Escena 3D con CSS: inclina con el puntero y con el scroll. Sin WebGL. Con movimiento reducido queda plana. */
export function Stage3D({ children, className = "", flip = 1 }: { children: React.ReactNode; className?: string; flip?: 1 | -1 }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 90, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 90, damping: 18, mass: 0.6 });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scrollY = useTransform(scrollYProgress, [0, 1], [16 * flip, -16 * flip]);
  const scrollX = useTransform(scrollYProgress, [0, 1], [7, -7]);
  const rotateY = useTransform([scrollY, sx], ([a, b]) => (a as number) + (b as number) * 12);
  const rotateX = useTransform([scrollX, sy], ([a, b]) => (a as number) - (b as number) * 8);

  useEffect(() => {
    if (reduce) return;
    const on = (e: PointerEvent) => {
      px.set((e.clientX / window.innerWidth - 0.5) * 2);
      py.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, [reduce, px, py]);

  if (reduce) return <div className={`relative ${className}`}>{children}</div>;
  return (
    <div ref={ref} className={`relative ${className}`} style={{ perspective: 1100 }}>
      <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>{children}</motion.div>
    </div>
  );
}

/** Capa con profundidad (z) dentro de un Stage3D. Flota sola; `className` posiciona. */
export function Depth({
  z = 0,
  rotate = 0,
  float = 8,
  delay = 0,
  className = "",
  children,
}: {
  z?: number;
  rotate?: number;
  float?: number;
  delay?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={{ z, rotate }}
      animate={reduce || !float ? undefined : { y: [0, -float, 0] }}
      transition={{ duration: 5 + delay, ease: "easeInOut", repeat: Infinity, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Teléfono con grosor: capas oscuras detrás para que, al inclinar, se vea volumen. */
export function Phone3D({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className="phone-float relative" style={{ transformStyle: "preserve-3d" }}>
      {[-7, -14, -21].map((z) => (
        <div
          key={z}
          aria-hidden
          className="absolute left-1/2 top-0 h-[496px] w-[250px] rounded-[2rem] bg-[#0b0d14]"
          style={{ transform: `translate(-50%, 0) translateZ(${z}px)` }}
        />
      ))}
      <Phone dark={dark} className="!animate-none">{children}</Phone>
    </div>
  );
}

/** Anillos y bloques decorativos que dan fondo al hero. */
export function HeroShapes() {
  return (
    <>
      <Depth z={-90} float={14} className="pointer-events-none absolute -right-10 top-4 h-72 w-72 rounded-full border-[14px] border-[#D6FF4A]/70" />
      <Depth z={-40} float={10} delay={1} className="pointer-events-none absolute -left-16 top-1/3 h-28 w-28 rounded-full bg-white/15 backdrop-blur-sm" />
      <Depth z={70} float={12} delay={2} rotate={18} className="pointer-events-none absolute bottom-2 right-6 h-10 w-10 rounded-xl bg-[#FF5A7A]" />
    </>
  );
}
