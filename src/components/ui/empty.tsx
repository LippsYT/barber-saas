import type { LucideIcon } from "lucide-react";
export function Empty({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text?: string; children?: React.ReactNode }) {
  return (<div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card/60 px-6 py-10 text-center">
    <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-gold/15 text-gold-700"><Icon className="h-6 w-6" /></div>
    <div className="font-display text-lg font-semibold">{title}</div>{text && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{text}</p>}{children && <div className="mt-4">{children}</div>}</div>);
}
