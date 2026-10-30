"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { PhoneMockup } from "./PhoneMockup";

const HeroCanvas = dynamic(() => import("./HeroCanvas"), {
  ssr: false,
  loading: () => <PhoneMockup />,
});

type NavWithHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

/** Desktop-only. Mobile, reduced motion, save-data and very small devices keep the static frame. */
export function canUseHero3D() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (window.matchMedia("(max-width: 767px)").matches) return false;
  if (window.matchMedia("(pointer: coarse)").matches) return false;
  const nav = navigator as NavWithHints;
  if (nav.connection?.saveData) return false;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 && nav.deviceMemory <= 2) return false;
  if ((navigator.hardwareConcurrency ?? 8) <= 2) return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return false;
  } catch {
    return false;
  }
  return true;
}

export function HeroVisual() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const update = () => setEnabled(canUseHero3D());
    update();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const width = window.matchMedia("(max-width: 767px)");
    const coarse = window.matchMedia("(pointer: coarse)");
    motion.addEventListener("change", update);
    width.addEventListener("change", update);
    coarse.addEventListener("change", update);
    return () => {
      motion.removeEventListener("change", update);
      width.removeEventListener("change", update);
      coarse.removeEventListener("change", update);
    };
  }, []);

  if (!enabled) return <PhoneMockup />;

  return (
    <div className="relative h-[min(72vh,640px)] w-full" role="img" aria-label="Escultura tridimensional de un poste de barbero y unas tijeras">
      <HeroCanvas />
    </div>
  );
}
