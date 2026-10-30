import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#2F5BFF" />
      <path d="M5.5 17.5h6.2l2.1-6.2 3.2 10.2 2.2-6h7.3" fill="none" stroke="#D6FF4A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display text-[1.7rem] font-extrabold uppercase leading-none tracking-tight", light ? "text-white" : "text-ink", className)}>
      <Mark className="h-7 w-7" />
      Pulso
    </span>
  );
}
