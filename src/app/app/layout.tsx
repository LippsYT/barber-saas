"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { sb } from "@/lib/supabase";
import { AppCtx, type Ctx } from "@/components/ctx";
import { CalendarDays, Wallet, Users, Calculator, BookOpen, BarChart3, Scissors, UserCog, MoreHorizontal, LogOut, X, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

const ROLE_ES = { owner: "Dueño", admin: "Admin", receptionist: "Recepción", barber: "Barbero" } as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const path = usePathname();
  const [ctx, setCtx] = useState<Ctx | null>(null); const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
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
  if (!ctx) return <div className="grid min-h-screen place-items-center bg-background"><div className="flex items-center gap-3 text-muted-foreground"><Scissors className="h-5 w-5 animate-pulse text-gold" />Cargando…</div></div>;
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
      <div className="min-h-screen bg-background md:flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-ink p-5 text-cream md:flex">
          <div className="mb-8 flex items-center gap-2 font-display text-xl"><Scissors className="h-5 w-5 text-gold" />Barbería<span className="text-gold">.</span></div>
          <nav className="flex-1 space-y-1">{items.map(([h, l, , I]) => (
            <Link key={h} href={h} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active(h) ? "bg-gold text-ink font-semibold" : "text-cream/70 hover:bg-white/5 hover:text-cream"}`}><I className="h-4 w-4" />{l}</Link>))}</nav>
          <div className="flex items-center gap-3 border-t border-white/10 pt-4"><Avatar name={ctx.biz.name} size={36} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{ctx.biz.name}</div><div className="text-xs text-cream/50">{ROLE_ES[ctx.role]}</div></div>
            <button aria-label="Salir" title="Salir" className="rounded-lg p-2 text-cream/60 hover:bg-white/10 hover:text-cream" onClick={logout}><LogOut className="h-4 w-4" /></button></div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between bg-ink px-4 py-3 text-cream md:hidden">
            <div className="flex items-center gap-3"><Avatar name={ctx.biz.name} size={34} /><div><div className="font-display text-base leading-tight">{ctx.biz.name}</div><div className="text-[11px] text-cream/50">{ROLE_ES[ctx.role]}</div></div></div>
            <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-cream/70 hover:bg-white/10" onClick={logout}><LogOut className="h-4 w-4" />Salir</button>
          </header>
          <div className="mx-auto max-w-3xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-10">{children}</div>
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] text-cream backdrop-blur md:hidden">
          <div className="grid grid-cols-5">
            {primary.map(([h, l, , I]) => (<Link key={h} href={h} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active(h) ? "text-gold" : "text-cream/60"}`}><I className="h-5 w-5" />{l.replace("Mis comisiones", "Comisiones")}</Link>))}
            {rest.length > 0 && <button onClick={() => setMore(!more)} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${more || rest.some((r) => active(r[0])) ? "text-gold" : "text-cream/60"}`}>{more ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}Más</button>}
          </div>
        </nav>
        {more && <div className="fixed inset-0 z-20 bg-ink/40 md:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-x-3 bottom-20 rounded-2xl bg-card p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {rest.map(([h, l, , I]) => <Link key={h} href={h} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${active(h) ? "bg-muted font-semibold" : ""}`}><I className="h-5 w-5 text-gold-600" />{l}</Link>)}
          </div></div>}
      </div>
    </AppCtx.Provider>
  );
}
