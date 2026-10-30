"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { sb } from "@/lib/supabase";
import { AppCtx, type Ctx } from "@/components/ctx";

const ROLE_ES = { owner: "Dueño", admin: "Admin", receptionist: "Recepción", barber: "Barbero" } as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const path = usePathname();
  const [ctx, setCtx] = useState<Ctx | null>(null);
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
  if (!ctx) return <p className="pt-10 text-center text-gray-500">Cargando…</p>;
  const nav: [string, string, boolean][] = [
    ["/app", "Agenda", true], ["/app/cobro", "Cobrar", true], ["/app/clientes", "Clientes", true],
    ["/app/caja", "Caja", ctx.canCash], ["/app/libro", "Libro", ctx.isManager], ["/app/reportes", ctx.role === "barber" ? "Mis comisiones" : "Reportes", ctx.role !== "receptionist"],
    ["/app/servicios", "Servicios", ctx.isManager], ["/app/equipo", "Equipo", ctx.isManager],
  ];
  return (
    <AppCtx.Provider value={ctx}>
      <header className="mb-4 flex items-center justify-between">
        <div><div className="font-bold">{ctx.biz.name}</div><div className="text-xs text-gray-500">{ROLE_ES[ctx.role]}</div></div>
        <button className="btn2" onClick={async () => { await sb().auth.signOut(); router.replace("/login"); }}>Salir</button>
      </header>
      <nav className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {nav.filter((n) => n[2]).map(([h, l]) => <Link key={h} href={h} className={`chip whitespace-nowrap ${path === h ? "chip-on" : "bg-white"}`}>{l}</Link>)}
      </nav>
      {children}
    </AppCtx.Provider>
  );
}
