"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { sb } from "@/lib/supabase";
import { AppCtx, type Ctx } from "@/components/ctx";
import { CalendarDays, Wallet, Users, Calculator, BookOpen, BarChart3, Scissors, UserCog, LogOut, MessageCircle, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { TabBar } from "@/components/app/TabBar";

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
    const m = data?.[0] as { role: Ctx["role"]; id: string; business: Ctx["biz"] } | undefined;
    if (!m) return router.replace("/onboarding");
    const role = m.role;
    setCtx({ biz: m.business, role, memberId: m.id, userId: u.user.id, isManager: role === "owner" || role === "admin", canCash: role !== "barber" });
  })(); }, [router]);
  if (!ctx) return <div className="grid min-h-screen place-items-center bg-ink text-white"><Logo light /></div>;
  const nav: [string, string, boolean, LucideIcon][] = [
    ["/app", "Inicio", true, CalendarDays], ["/app/agenda", "Agenda", true, CalendarDays], ["/app/cobro", "Cobrar", true, Wallet], ["/app/caja", "Caja", ctx.canCash, Calculator],
    ["/app/reportes", ctx.role === "barber" ? "Mis comisiones" : "Reportes", ctx.role !== "receptionist", BarChart3],
    ["/app/clientes", "Clientes", true, Users], ["/app/libro", "Libro", ctx.isManager, BookOpen],
    ["/app/servicios", "Servicios", ctx.isManager, Scissors], ["/app/equipo", "Equipo", ctx.isManager, UserCog],
    ["/app/whatsapp", "WhatsApp", ctx.isManager, MessageCircle],
  ];
  const items = nav.filter((n) => n[2]);
  const logout = async () => { await sb().auth.signOut(); router.replace("/login"); };
  const active = (h: string) => path === h;
  return (
    <AppCtx.Provider value={ctx}>
      <div className="app-canvas min-h-screen md:flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-black/5 bg-ink p-5 text-white md:flex">
          <Link href="/app" className="mb-8"><Logo light /></Link>
          <nav className="flex-1 space-y-1">{items.map(([h, l, , I]) => (
            <Link key={h} href={h} aria-current={active(h) ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active(h) ? "bg-[#D6FF4A] text-ink" : "text-white/70 hover:bg-white/5 hover:text-white"}`}><I className="h-4 w-4" />{l}</Link>))}</nav>
          <div className="border-t border-white/10 pt-4">
            <div className="truncate text-sm font-semibold">{ctx.biz.name}</div>
            <div className="text-xs text-white/50">{ROLE_ES[ctx.role]}</div>
            <button className="mt-3 flex items-center gap-2 text-sm text-white/70" onClick={logout}><LogOut className="h-4 w-4" />Salir</button>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between bg-[#F4F1E8]/90 px-4 py-3 backdrop-blur md:hidden">
            <Logo className="text-xl" />
            <button className="text-sm font-bold text-ink/60" onClick={logout}>Salir</button>
          </header>
          <div className="mx-auto max-w-3xl px-4 pb-28 pt-4 md:px-8 md:pb-12 md:pt-8">
            <motion.div key={path} initial={entered && reduce === false ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              {children}
            </motion.div>
          </div>
        </div>
        <TabBar path={path} canCash={ctx.canCash} open={more} onToggle={() => setMore(!more)} />
        {more && <div className="fixed inset-0 z-20 bg-ink/40 md:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-x-4 bottom-24 space-y-2 rounded-3xl bg-white p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <Link href="/app/agenda?nueva=1" className="btn w-full">Nueva cita</Link>
            <Link href="/app/cobro" className="btn2 w-full">Nueva venta</Link>
            {ctx.isManager && <Link href="/app/servicios" className="btn2 w-full">Nuevo servicio</Link>}
          </div>
        </div>}
      </div>
    </AppCtx.Provider>
  );
}
