import { cn } from "@/lib/utils";

export type ChispaPose = "stand" | "run" | "wave" | "heart" | "point";

/** Chispa: el barbero de Pulso (WebP animado con fondo transparente). `pose` se mantiene por compatibilidad: la imagen es una sola. */
export function Chispa({ className }: { pose?: ChispaPose; className?: string }) {
  return <img src="/mascot/barbero.webp" alt="Chispa, el barbero de Pulso" width={288} height={438} className={cn("pointer-events-none h-auto select-none", className)} />;
}
