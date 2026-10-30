"use client";
import Link from "next/link";
import { CalendarDays, Home, Plus, Users, Wallet, X } from "lucide-react";

const TABS = [
  { href: "/app", label: "Inicio", icon: Home },
  { href: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/app/clientes", label: "Clientes", icon: Users },
  { href: "/app/caja", label: "Caja", icon: Wallet },
];

export function TabBar({ path, canCash, open, onToggle }: { path: string; canCash: boolean; open: boolean; onToggle: () => void }) {
  const right = canCash ? TABS[3] : { href: "/app/reportes", label: "Reportes", icon: Wallet };
  const items = [TABS[0], TABS[1], TABS[2], right];
  const left = items.slice(0, 2);
  const rest = items.slice(2);
  const active = (h: string) => path === h;
  const Item = ({ href, label, icon: I }: { href: string; label: string; icon: typeof Home }) => (
    <Link href={href} aria-current={active(href) ? "page" : undefined} className={`flex min-w-0 flex-col items-center gap-0.5 pb-2 pt-2 text-[10px] font-bold uppercase ${active(href) ? "text-[#2F5BFF]" : "text-ink/45"}`}>
      <I className="h-5 w-5" />{label}
    </Link>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/95 pb-safe shadow-[0_-10px_30px_rgba(7,11,20,.08)] backdrop-blur md:hidden">
      <div className="grid h-[var(--nav-h)] grid-cols-5 items-end">
        {left.map((t) => <Item key={t.href} {...t} />)}
        <button aria-expanded={open} aria-label={open ? "Cerrar acciones" : "Nueva cita o venta"} onClick={onToggle} className="-mt-6 grid h-14 w-14 place-self-center place-items-center rounded-full bg-[#D6FF4A] text-ink shadow-[0_10px_24px_rgba(214,255,74,.55)]">
          {open ? <X className="h-6 w-6" /> : <Plus className="h-7 w-7" />}
        </button>
        {rest.map((t) => <Item key={t.href} {...t} />)}
      </div>
    </nav>
  );
}
