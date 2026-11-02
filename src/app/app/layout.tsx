"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { sb } from "@/lib/supabase";
import { AppCtx, type Ctx } from "@/components/ctx";
import { CalendarDays, Wallet, Users, Calculator, BookOpen, BarChart3, LogOut, Settings, type LucideIcon } from "lucide-react";
import { applySavedTheme } from "@/components/app/ThemeToggle";
import { Logo } from "@/components/brand/Logo";
import { TabBar } from "@/components/app/TabBar";
import { Splash } from "@/components/app/Splash";
import { Paywall } from "@/components/app/Paywall";
import { LockedAddon } from "@/components/app/LockedAddon";
import { PushPrompt } from "@/components/app/PushPrompt";
import type { AddonKey } from "@/lib/addons";

const ROLE_ES = { owner: "Dueño", admin: "Admin", receptionist: "Recepción", barber: "Barbero" } as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const path = usePathname();
  const reduce = useReducedMotion();
  type Billing = { active: boolean; exempt: boolean; trial_ends_at: string; status: string; all?: boolean; addons?: string[] };
  const [billing, setBilling] = useState<Billing | null>(null);
  const [ctx, setCtx] = useState<Omit<Ctx, "has"> | null>(null); const [more, setMore] = useState(false); const [entered, setEntered] = useState(false);
  useEffect(() => setMore(false), [path]);
  useEffect(() => setEntered(true), []);
  const [joined, setJoined] = useState(false);
  // El barbero solo usa Inicio, Agenda y Mis comisiones: si abre a mano otra pantalla (clientes, cobro, caja, libro, ajustes) vuelve a sus comisiones.
  useEffect(() => {
    if (ctx?.role === "barber" && ["/app/clientes", "/app/cobro", "/app/caja", "/app/libro", "/app/ajustes"].some((p) => path === p || path.startsWith(`${p}/`))) router.replace("/app/reportes");
  }, [ctx?.role, path, router]);
  // Tema claro/oscuro guardado; al salir de /app se quita para no afectar las páginas públicas.
  useEffect(() => { applySavedTheme(); return () => document.documentElement.classList.remove("app-dark"); }, []);
  useEffect(() => { (async () => {
    const { data: u } = await sb().auth.getUser();
    if (!u.user) return router.replace("/login");
    // Si la barbería había invitado este correo, aquí queda vinculado a su puesto; se avisa una vez.
    const { data: claimed } = await sb().rpc("claim_my_invitations");
    if (Number(claimed) > 0) setJoined(true);
    const { data } = await sb().from("memberships").select("id, role, business:businesses(id,name,slug,timezone,currency)").eq("user_id", u.user.id).eq("active", true).limit(1);
    const m = data?.[0] as { role: Ctx["role"]; id: string; business: Ctx["biz"] } | undefined;
    if (!m) return router.replace("/onboarding");
    const role = m.role;
    // Si la consulta falla (por ejemplo la migración aún no está aplicada) no se bloquea a nadie.
    const { data: bill } = await sb().rpc("my_billing");
    if (bill) setBilling(bill as Billing);
    setCtx({ biz: m.business, role, memberId: m.id, userId: u.user.id, isManager: role === "owner" || role === "admin", canCash: role !== "barber" });
  })(); }, [router]);
  if (!ctx) return <><Splash ready={false} /><div className="grid min-h-screen place-items-center bg-ink text-white"><Logo light /></div></>;
  const nav: [string, string, boolean, LucideIcon][] = [
    ["/app", "Inicio", true, CalendarDays], ["/app/agenda", "Agenda", true, CalendarDays], ["/app/cobro", "Cobrar", ctx.canCash, Wallet], ["/app/caja", "Caja", ctx.canCash, Calculator],
    ["/app/reportes", ctx.role === "barber" ? "Mis comisiones" : "Reportes", ctx.role !== "receptionist", BarChart3],
    ["/app/clientes", "Clientes", ctx.canCash, Users], ["/app/libro", "Libro", ctx.isManager, BookOpen],
    ["/app/ajustes", "Ajustes", ctx.isManager, Settings],
  ];
  const items = nav.filter((n) => n[2]);
  // Sin datos de facturación (migración aún sin aplicar) no se bloquea nada; si la respuesta no trae complementos, tampoco.
  const has = (k: AddonKey) => billing === null || billing.all === undefined || billing.all || (billing.addons ?? []).includes(k);
  const GATED: Record<string, AddonKey> = { "/app/whatsapp": "whatsapp", "/app/mensajes": "whatsapp", "/app/inventario": "inventario" };
  const needs = GATED[path];
  const blocked = billing !== null && !billing.active && !(ctx.role === "owner" && path.startsWith("/app/suscripcion"));
  const trialDays = billing && billing.active && !billing.exempt && !["active", "trialing", "past_due"].includes(billing.status)
    ? Math.ceil((Date.parse(billing.trial_ends_at) - Date.now()) / 86400000) : null;
  if (blocked) return <><Splash ready /><Paywall isOwner={ctx.role === "owner"} businessName={ctx.biz.name} onLogout={async () => { await sb().auth.signOut(); router.replace("/login"); }} /></>;
  const logout = async () => { await sb().auth.signOut(); router.replace("/login"); };
  // Las pantallas de configuración cuelgan de Ajustes: el ítem sigue marcado mientras estás en ellas.
  const SETTINGS = ["servicios", "equipo", "horario", "whatsapp", "pulselink", "referidos", "suscripcion", "mensajes", "reglas", "perfil", "inventario", "finanzas", "compartir", "notificaciones", "suscripcion/complementos"];
  const active = (h: string) => path === h || (h === "/app/ajustes" && SETTINGS.some((s) => path === `/app/${s}`));
  return (
    <><Splash ready />
    <AppCtx.Provider value={{ ...ctx, has }}>
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
        <div className="min-w-0 flex-1 overflow-x-clip">
          <header className="sticky top-0 z-20 flex items-center justify-between bg-[#F4F1E8]/90 px-4 pb-3 pt-[calc(.75rem+var(--sat))] backdrop-blur md:hidden">
            <Logo className="text-xl" />
            <button className="text-sm font-bold text-ink/60" onClick={logout}>Salir</button>
          </header>
          <PushPrompt />
          {joined && <div role="status" className="flex items-center justify-between gap-3 bg-[#E3F8EA] px-4 py-2 text-sm font-semibold text-[#0B5B2B]"><span>¡Bienvenido! Ya eres parte de {ctx.biz.name} como {ROLE_ES[ctx.role]}.</span><button aria-label="Cerrar aviso" className="text-lg leading-none" onClick={() => setJoined(false)}>×</button></div>}
          {trialDays !== null && trialDays <= 7 && ctx.role === "owner" && <Link href="/app/suscripcion" className="block bg-[#D6FF4A] px-4 py-2 text-center text-sm font-bold text-[#070B14]">
            {trialDays > 0 ? `Te ${trialDays === 1 ? "queda 1 día" : `quedan ${trialDays} días`} de prueba · Activar suscripción` : "Tu prueba termina hoy · Activar suscripción"}</Link>}
          <div className="mx-auto max-w-3xl px-4 pb-app-nav pt-4 md:px-8 md:pb-12 md:pt-8">
            <motion.div key={path} initial={entered && reduce === false ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              {needs && !has(needs) ? <LockedAddon addon={needs} /> : children}
            </motion.div>
          </div>
        </div>
        <TabBar path={path} canCash={ctx.canCash} isManager={ctx.isManager} activeFor={active} open={more} onToggle={() => setMore(!more)} />
        {more && <div className="fixed inset-0 z-20 bg-ink/40 md:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-x-4 bottom-app-nav space-y-2 rounded-3xl bg-white p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <Link href="/app/agenda?nueva=1" className="btn w-full">Nueva cita</Link>
            {ctx.canCash && <Link href="/app/cobro" className="btn2 w-full">Nueva venta</Link>}
            {ctx.isManager && <Link href="/app/servicios" className="btn2 w-full">Nuevo servicio</Link>}
            <div className="grid grid-cols-3 gap-2 border-t border-black/5 pt-3">
              {items.filter(([h]) => ["/app/cobro", "/app/libro"].includes(h) || (h === "/app/reportes" && ctx.canCash)).map(([h, l, , I]) => (
                <Link key={h} href={h} className="flex flex-col items-center gap-1 rounded-2xl bg-ink/5 px-2 py-3 text-xs font-bold text-ink/70"><I className="h-5 w-5" />{l}</Link>))}
            </div>
          </div>
        </div>}
      </div>
    </AppCtx.Provider></>
  );
}
