"use client";
import Link from "next/link";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { BarChart3, CalendarDays, Home, Plus, Settings, Users, Wallet, X, type LucideIcon } from "lucide-react";

type Tab = { href: string; label: string; icon: LucideIcon };

const SPRING = { type: "spring", stiffness: 520, damping: 38, mass: 0.8 } as const;

export function TabBar({ path, canCash, open, onToggle, isManager = true, activeFor }: {
  path: string; canCash: boolean; open: boolean; onToggle: () => void; isManager?: boolean; activeFor?: (href: string) => boolean;
}) {
  const reduce = useReducedMotion();
  const tabs: Tab[] = [
    { href: "/app", label: "Inicio", icon: Home },
    { href: "/app/agenda", label: "Agenda", icon: CalendarDays },
    canCash ? { href: "/app/caja", label: "Caja", icon: Wallet } : { href: "/app/reportes", label: "Comisiones", icon: BarChart3 },
    // Quien no maneja caja (el barbero) no ve la lista de clientes: solo su agenda, sus comisiones y sus adelantos.
    ...(canCash ? [{ href: "/app/clientes", label: "Clientes", icon: Users }] : []),
    ...(isManager ? [{ href: "/app/ajustes", label: "Ajustes", icon: Settings }] : []),
  ];
  const active = (h: string) => (activeFor ? activeFor(h) : path === h);
  return (
    <nav aria-label="Navegación principal" className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(var(--sab)+.75rem)] md:hidden">
      <div className="mx-auto flex max-w-md items-center gap-2">
        <div className="glass-bar pointer-events-auto flex h-14 min-w-0 flex-1 items-center justify-between rounded-full p-1.5">
          {tabs.map(({ href, label, icon: I }) => {
            const on = active(href);
            return (
              <Link key={href} href={href} aria-label={label} aria-current={on ? "page" : undefined}
                className={`relative flex h-11 items-center justify-center rounded-full transition-colors ${on ? "px-3.5" : "w-11"} ${on ? "text-[#D6FF4A]" : "text-ink/55 active:scale-90"}`}>
                {on && <motion.span layoutId="tab-pill" transition={reduce ? { duration: 0 } : SPRING} className="glass-pill absolute inset-0 rounded-full" />}
                <motion.span className="relative flex items-center gap-1.5" animate={on && !reduce ? { scale: [0.86, 1] } : { scale: 1 }} transition={SPRING}>
                  <I className="h-[1.15rem] w-[1.15rem]" strokeWidth={on ? 2.4 : 2} />
                  <AnimatePresence initial={false}>
                    {on && <motion.span key="l" initial={reduce ? false : { width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={reduce ? undefined : { width: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden whitespace-nowrap text-xs font-bold">{label}</motion.span>}
                  </AnimatePresence>
                </motion.span>
              </Link>
            );
          })}
        </div>
        <motion.button whileTap={reduce ? undefined : { scale: 0.88 }} aria-expanded={open} aria-label={open ? "Cerrar acciones" : "Nueva cita o venta"} onClick={onToggle}
          className="glass-bar glass-fab pointer-events-auto grid h-14 w-14 shrink-0 place-items-center rounded-full text-ink">
          <motion.span animate={{ rotate: open ? 135 : 0 }} transition={SPRING} className="grid place-items-center">
            {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" strokeWidth={2.4} />}
          </motion.span>
        </motion.button>
      </div>
    </nav>
  );
}
