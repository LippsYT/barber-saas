"use client";
import Link from "next/link";
import { BellRing, Boxes, Building2, CalendarClock, ChevronRight, CreditCard, Gift, Link2, MessageCircle, Palette, Scissors, Share2, SlidersHorizontal, UserCog, Wallet, type LucideIcon } from "lucide-react";
import { useApp } from "@/components/ctx";
import { ThemeToggle } from "@/components/app/ThemeToggle";

type Item = { href: string; title: string; hint: string; icon: LucideIcon; ownerOnly?: boolean };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Catálogo", items: [
    { href: "/app/servicios", title: "Servicios", hint: "Crea, edita y organiza tus servicios", icon: Scissors },
    { href: "/app/equipo", title: "Equipo", hint: "Barberos, fotos, roles y comisiones", icon: UserCog },
    { href: "/app/inventario", title: "Inventario", hint: "Productos, stock y proveedores", icon: Boxes },
  ] },
  { title: "Tu negocio", items: [
    { href: "/app/perfil", title: "Perfil del negocio", hint: "Nombre, portada, portafolio y enlace de reserva", icon: Building2 },
    { href: "/app/horario", title: "Horario del negocio", hint: "Horas de atención por día y días especiales", icon: CalendarClock },
    { href: "/app/reglas", title: "Reglas de reserva", hint: "Anticipación, intervalos y cancelaciones", icon: SlidersHorizontal },
    { href: "/app/finanzas", title: "Pagos y gastos", hint: "Métodos de pago y tipos de gasto", icon: Wallet },
  ] },
  { title: "Clientes y marketing", items: [
    { href: "/app/mensajes", title: "Mensajes automáticos", hint: "Confirmaciones, recordatorios, reseñas e informe semanal", icon: BellRing },
    { href: "/app/whatsapp", title: "WhatsApp", hint: "Conecta tu número y reactiva clientes", icon: MessageCircle },
    { href: "/app/pulselink", title: "Pulse Link", hint: "Tu página de enlaces para Instagram y WhatsApp", icon: Link2 },
    { href: "/app/compartir", title: "Contenido para compartir", hint: "Piezas con la imagen de tu negocio", icon: Share2 },
    { href: "/app/referidos", title: "Referidos", hint: "Invita a otras barberías a Pulso", icon: Gift },
  ] },
  { title: "Cuenta", items: [
    { href: "/app/suscripcion", title: "Suscripción", hint: "Tu plan de Pulso y facturación", icon: CreditCard, ownerOnly: true },
  ] },
];

export default function Ajustes() {
  const { biz, role } = useApp();
  return (
    <main className="min-w-0 space-y-5">
      <div><div className="eyebrow mb-1">{biz.name}</div><h1 className="h1 !mb-0">Ajustes</h1></div>
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => !i.ownerOnly || role === "owner");
        if (!items.length) return null;
        return (
          <section key={g.title} aria-label={g.title}>
            <div className="mb-1.5 px-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink/50">{g.title}</div>
            <div className="card divide-y divide-black/5 p-0">{items.map(({ href, title, hint, icon: Icon }) => (
              <Link key={href} href={href} className="flex min-h-[64px] min-w-0 items-center gap-3 px-3 py-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#2F5BFF]/10 text-[#2F5BFF]"><Icon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="block text-xs text-ink/55">{hint}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink/30" />
              </Link>))}</div>
          </section>);
      })}
      <section aria-label="Apariencia">
        <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink/50"><Palette className="h-3.5 w-3.5" />Apariencia</div>
        <div className="card"><ThemeToggle /></div>
      </section>
    </main>
  );
}
