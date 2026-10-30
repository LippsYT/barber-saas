"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { sb } from "@/lib/supabase";
import { AppCtx, type Ctx } from "@/components/ctx";
import { CalendarDays, Wallet, Users, Calculator, BookOpen, BarChart3, Scissors, UserCog, MoreHorizontal, LogOut, X, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

const ROLE_ES = { owner: "Dueño", admin: "Admin", receptionist: "Recepción", barber: "Barbero" } as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const path = usePathname();
  const reduce = useReducedMotion();
  const [ctx, setCtx] = useState<Ctx | null>(null); const [more, setMore] = useState(false); const [entered, setEntered] = useState(false);
  useEffect(() => setMore(false), [path]);
  useEffect(() => setEntered(true), []);
  useEffect(() => { (async () => {
    const { data: u } = await sb().auth.getUser();
    if (!u.user) return router.replace("/login");
    await sb().rpc("claim_my_invitations");
    const { data } = await sb().from("memberships").select("id, role, business:businesses(id,name,slug,timezone,currency)").eq("user_id", u.user.id).eq("active", true).limit(1);
    const m = data?.[0] as any;
    if (!m) return router.replace("/onboarding");
    const role = m.role;
    setCtx({ biz: m.business, role, memberId: m.id, userId: u.user.id, isManager: role === "owner" || role === "admin", canCash: role !== "barber" });
  })(); }, [router]);
  if (!ctx) return <div className="grid min-h-screen place-items-center bg-ink text-cream"><div className="flex flex-col items-center gap-3"><Scissors className="h-7 w-7 animate-pulse text-gold" /><p className="font-display text-xl">Cargando tu barbería…</p></div></div>;
  const nav: [string, string, boolean, LucideIcon][] = [
    ["/app", "Agenda", true, CalendarDays], ["/app/cobro", "Cobrar", true, Wallet], ["/app/caja", "Caja", ctx.canCash, Calculator],
    ["/app/reportes", ctx.role === "barber" ? "Mis comisiones" : "Reportes", ctx.role !== "receptionist", BarChart3],
    ["/app/clientes", "Clientes", true, Users], ["/app/libro", "Libro", ctx.isManager, BookOpen],
    ["/app/servicios", "Servicios", ctx.isManager, Scissors], ["/app/equipo", "Equipo", ctx.isManager, UserCog],
  ];
  const items = nav.filter((n) => n[2]); const primary = items.slice(0, 4); const rest = items.slice(4);
  const logout = async () => { await sb().auth.signOut(); router.replace("/login"); };
  const active = (h: string) => path === h;
  return (
    <AppCtx.Provider value={ctx}>
      <div className="app-canvas min-h-screen md:flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/5 bg-ink p-5 text-cream md:flex">
          <Link href="/app" className="mb-8 flex items-center gap-2 font-display text-xl"><Scissors className="h-5 w-5 text-gold" />Barbería<span className="text-gold">.</span></Link>
          <nav className="flex-1 space-y-1">{items.map(([h, l, , I]) => (
            <Link key={h} href={h} aria-current={active(h) ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition duration-200 ${active(h) ? "bg-gold font-semibold text-ink shadow-[0_8px_24px_rgba(201,163,92,.25)]" : "text-cream/70 hover:bg-white/5 hover:text-cream"}`}><I className="h-4 w-4" />{l}</Link>))}</nav>
          <div className="flex items-center gap-3 border-t border-white/10 pt-4"><Avatar name={ctx.biz.name} size={36} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{ctx.biz.name}</div><div className="text-xs text-cream/50">{ROLE_ES[ctx.role]}</div></div>
            <button aria-label="Salir" title="Salir" className="rounded-lg p-2 text-cream/60 transition hover:bg-white/10 hover:text-cream" onClick={logout}><LogOut className="h-4 w-4" /></button></div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-ink/95 px-4 py-3 text-cream backdrop-blur md:hidden">
            <div className="flex items-center gap-3"><Avatar name={ctx.biz.name} size={34} /><div><div className="font-display text-base leading-tight">{ctx.biz.name}</div><div className="text-[11px] text-cream/50">{ROLE_ES[ctx.role]}</div></div></div>
            <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-cream/70 transition hover:bg-white/10" onClick={logout}><LogOut className="h-4 w-4" />Salir</button>
          </header>
          <div className="mx-auto max-w-3xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-10">
            <motion.div
              key={path}
              initial={entered && reduce === false ? { opacity: 0, y: 12 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </div>
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] text-cream shadow-[0_-12px_40px_rgba(0,0,0,.25)] backdrop-blur md:hidden">
          <div className="grid grid-cols-5">
            {primary.map(([h, l, , I]) => (
              <Link key={h} href={h} aria-current={active(h) ? "page" : undefined} className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] transition ${active(h) ? "text-gold" : "text-cream/55"}`}>
                {active(h) && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-gold" />}
                <I className={`h-5 w-5 transition ${active(h) ? "scale-110" : ""}`} />
                {l.replace("Mis comisiones", "Comisiones")}
              </Link>
            ))}
            {rest.length > 0 && <button aria-expanded={more} onClick={() => setMore(!more)} className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] transition ${more || rest.some((r) => active(r[0])) ? "text-gold" : "text-cream/55"}`}>{(more || rest.some((r) => active(r[0]))) && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-gold" />}{more ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}Más</button>}
          </div>
        </nav>
        {more && <div className="fixed inset-0 z-20 bg-ink/50 backdrop-blur-[2px] md:hidden" onClick={() => setMore(false)}>
          <div className="rise absolute inset-x-3 bottom-20 rounded-2xl border border-border bg-card p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {rest.map(([h, l, , I]) => <Link key={h} href={h} className={`flex items-center gap-3 rounded-xl px-4 py-3.5 transition ${active(h) ? "bg-ink font-semibold text-cream" : "hover:bg-muted"}`}><I className="h-5 w-5 text-gold" />{l}</Link>)}
          </div></div>}
      </div>
    </AppCtx.Provider>
  );
}
