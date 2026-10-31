import { cn } from "@/lib/utils";
export function Avatar({ name, src, size = 56, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const ini = name.replace(/\(.*\)/, "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return src ? <img src={src} alt={name} width={size} height={size} loading="lazy" className={cn("shrink-0 rounded-full object-cover ring-2 ring-white", className)} style={{ width: size, height: size }} />
    : <div aria-hidden className={cn("grid shrink-0 place-items-center rounded-full bg-[#2F5BFF] font-display font-extrabold text-[#D6FF4A] ring-2 ring-white", className)} style={{ width: size, height: size, fontSize: size * 0.4 }}>{ini}</div>;
}
