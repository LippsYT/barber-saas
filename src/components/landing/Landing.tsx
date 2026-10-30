"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, MessageCircle, Mic } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Chispa } from "@/components/brand/Mascot";
import { Phone } from "@/components/brand/Phone";

const ease = [0.22, 1, 0.36, 1] as const;

function Slide({ id, className, children }: { id: string; className: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      id={id}
      className={`relative overflow-hidden px-5 py-16 sm:py-20 ${className}`}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.55, ease }}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">{children}</div>
    </motion.section>
  );
}

function Kicker({ n, label, light = false }: { n: string; label: string; light?: boolean }) {
  return <div className={`mb-4 text-xs font-extrabold uppercase tracking-[0.22em] ${light ? "text-white/70" : "text-ink/50"}`}>{n} · {label}</div>;
}

const PLANS = [
  { name: "Silla", price: 19, who: "Hasta 3 barberos", feats: ["Agenda y link de reservas", "Link por barbero", "Caja con cierre explicado", "Comisiones por servicio", "Clientes con WhatsApp"] },
  { name: "Casa", price: 39, who: "Hasta 10 barberos", feats: ["Todo lo de Silla", "Roles de admin y recepción", "Libro de caja con anulaciones", "Límites de gastos por rol", "Soporte por WhatsApp"], featured: true },
];
const FAQ = [
  ["¿Necesito instalar algo?", "No. Pulso abre en el navegador del celular o del computador. Puedes dejarlo en la pantalla de inicio."],
  ["¿Mis clientes crean una cuenta para reservar?", "No. Eligen fecha, barbero, servicio y horario, y dejan su nombre y WhatsApp."],
  ["¿Cómo se calculan las comisiones?", "Hay una regla del negocio y, si quieres, una por barbero y servicio: porcentaje o un monto fijo en dólares. En cada cobro, “ver cálculo” muestra la cuenta."],
  ["¿Puedo borrar una venta mal hecha?", "No se borra. Se anula con un asiento inverso y un motivo. La caja conserva la historia."],
  ["¿El precio es en dólares?", "Sí. US$ 19 al mes hasta 3 barberos y US$ 39 hasta 10. Sin permanencia."],
];

export function Landing() {
  return (
    <div className="bg-[#F4F1E8] text-ink">
      <a href="#inicio" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[#D6FF4A] focus:text-ink focus:px-3 focus:py-2">Saltar al contenido</a>
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#F4F1E8]/85 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <nav className="hidden gap-6 text-sm font-semibold text-ink/70 md:flex">
            <a href="#reservas" className="hover:text-ink">Reservas</a>
            <a href="#caja" className="hover:text-ink">Caja</a>
            <a href="#clientes" className="hover:text-ink">Clientes</a>
            <a href="#whatsapp" className="hover:text-ink">WhatsApp</a>
            <a href="#precios" className="hover:text-ink">Precios</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-full px-3 py-2 text-sm font-semibold">Entrar</Link>
            <Link href="/login?modo=registro" className="btn-gold py-2 text-sm">Crear cuenta</Link>
          </div>
        </div>
      </header>

      <Slide id="inicio" className="paper-blue min-h-[100svh] text-white">
        <div>
          <Kicker n="01" label="Inicio" light />
          <h1 className="display text-6xl sm:text-7xl md:text-8xl">Corta.<br />Cobra.<br /><span className="bg-[#D6FF4A] px-2 text-ink">Repite.</span></h1>
          <p className="mt-6 max-w-md text-lg text-white/85">La agenda, la caja y las reservas de tu barbería, en un solo pulso. En dólares. Desde el celular.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login?modo=registro" className="btn-gold">Empieza hoy <ArrowRight className="h-4 w-4" /></Link>
            <a href="#reservas" className="inline-flex items-center rounded-full border border-white/30 px-5 py-3 font-semibold">Ver la agenda</a>
          </div>
          <p className="mt-5 text-sm text-white/70">Sin permanencia · Precios en US$</p>
        </div>
        <div className="relative">
          <Chispa pose="run" className="absolute -left-6 bottom-6 z-20 w-36 sm:w-44" />
          <Phone>
            <div className="px-3 pt-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink/40">Buenas tardes</div>
              <div className="display text-2xl text-ink">Tus ventas</div>
              <div className="mt-3 rotate-[-2deg] rounded-2xl bg-white p-3 shadow-lg">
                <div className="text-[10px] font-bold uppercase text-ink/40">Octubre</div>
                <div className="display text-3xl text-[#14944A]">US$ 1.284</div>
                <div className="text-[11px] text-ink/50">Quedan días del mes en la caja</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-xl bg-white p-2"><b>32</b><div className="text-ink/50">Citas</div></div>
                <div className="rounded-xl bg-white p-2"><b>US$ 40</b><div className="text-ink/50">Ticket</div></div>
              </div>
            </div>
          </Phone>
          <div className="absolute right-0 top-8 z-20 grid h-20 w-20 place-items-center rounded-full bg-[#D6FF4A] text-center text-xs font-extrabold uppercase leading-tight text-ink shadow-lg">Tus<br />ventas</div>
        </div>
      </Slide>

      <Slide id="reservas" className="paper min-h-[90svh]">
        <div>
          <Kicker n="02" label="Reservas" />
          <h2 className="display text-5xl sm:text-7xl">Tu agenda,<br /><span className="bg-[#2F5BFF] px-2 text-white">siempre</span><br />llena.</h2>
          <p className="mt-5 max-w-md text-lg text-ink/70">Un link para la barbería y otro para cada barbero. El cliente elige fecha, servicio y hora. Tú ves la semana en bloques de color.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="pill bg-ink text-white">8 citas hoy</span>
            <span className="pill bg-white">Sin cruces</span>
          </div>
        </div>
        <div className="relative">
          <Phone>
            <div className="px-3">
              <div className="display text-xl">Agenda</div>
              <div className="mt-2 flex gap-1 text-[10px] font-bold">
                {["L", "M", "M", "J", "V", "S"].map((d, i) => <span key={i} className={`grid h-8 w-8 place-items-center rounded-full ${i === 2 ? "bg-[#2F5BFF] text-white" : "bg-white"}`}>{d}</span>)}
              </div>
              <div className="mt-3 space-y-2">
                <div className="rounded-xl bg-[#2F5BFF] p-2 text-[11px] text-white"><b>09:00</b> Kevin · servicio oro</div>
                <div className="rounded-xl bg-[#D6FF4A] p-2 text-[11px] text-ink"><b>10:30</b> Andrés · servicio vip</div>
                <div className="rounded-xl bg-[#FF5A7A] p-2 text-[11px] text-white"><b>12:00</b> Ricardo · kids</div>
              </div>
            </div>
          </Phone>
          <div className="absolute -right-1 bottom-8 z-20 w-40 rotate-3 rounded-2xl bg-[#9AD7FF] p-3 text-xs shadow-xl">
            <div className="font-extrabold">Mateo Ruiz</div>
            <div>09:00 – 09:45</div>
            <div className="text-ink/70">servicio oro</div>
          </div>
          <Chispa pose="stand" className="absolute -right-2 -top-6 z-20 w-28" />
        </div>
      </Slide>

      <Slide id="caja" className="paper min-h-[90svh]">
        <div className="relative order-2 md:order-1">
          <Phone>
            <div className="px-3">
              <div className="display text-2xl">Caja</div>
              <div className="mt-3 rounded-2xl bg-white p-3 shadow">
                <div className="text-[10px] font-bold uppercase text-ink/40">Saldo en caja</div>
                <div className="display text-4xl text-[#14944A]">US$ 186</div>
                <div className="mt-1 text-[11px] text-ink/50">Abierta hoy · 09:02</div>
                <div className="mt-2 text-right text-[11px] font-bold text-[#2F5BFF]">Ver detalles</div>
              </div>
            </div>
          </Phone>
          <div className="absolute right-2 top-16 z-20 grid h-24 w-24 place-items-center rounded-full bg-ink text-center text-white shadow-xl">
            <div><div className="text-lg font-extrabold text-[#D6FF4A]">+18%</div><div className="text-[10px] uppercase">vs semana</div></div>
          </div>
          <Chispa pose="point" className="absolute -bottom-4 left-0 z-20 w-32" />
        </div>
        <div className="order-1 md:order-2">
          <Kicker n="03" label="Caja" />
          <h2 className="display text-5xl sm:text-7xl">Caja clara.<br />Al <span className="bg-[#D6FF4A] px-2 text-ink">centavo.</span></h2>
          <p className="mt-5 max-w-md text-lg text-ink/70">Fondo, ventas, gastos y anulaciones. Cada total tiene “ver cálculo”: los asientos, uno por uno. Nada se borra; se reversa.</p>
        </div>
      </Slide>

      <Slide id="clientes" className="paper-dark min-h-[90svh] text-white">
        <div>
          <Kicker n="04" label="Clientes" light />
          <h2 className="display text-5xl text-white sm:text-7xl">Clientes<br />que <span className="text-[#9AD7FF]">vuelven.</span></h2>
          <p className="mt-5 max-w-md text-lg text-white/70">Nombre, WhatsApp y la historia de citas. Un botón abre el chat. Sin copiar números a mano.</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#D6FF4A] px-4 py-2 text-sm font-extrabold text-ink">Un toque y abre WhatsApp</div>
        </div>
        <div className="relative">
          <Phone dark>
            <div className="px-3 text-white">
              <div className="display text-2xl">Clientes</div>
              <div className="mt-2 rounded-full bg-white/10 px-3 py-2 text-[11px] text-white/50">Buscar…</div>
              {[["A", "antonieta"], ["J", "Juan"], ["N", "natalia sierra"]].map(([i, n]) => (
                <div key={n} className="mt-2 flex items-center gap-2 rounded-xl bg-white px-2 py-2 text-ink">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#2F5BFF] text-xs font-bold text-white">{i}</span>
                  <span className="flex-1 text-sm font-semibold">{n}</span>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#25D366] text-white"><MessageCircle className="h-3.5 w-3.5" /></span>
                </div>
              ))}
            </div>
          </Phone>
          <Chispa pose="heart" className="absolute -left-4 bottom-4 z-20 w-32" />
        </div>
      </Slide>

      <Slide id="whatsapp" className="paper-dark min-h-[90svh] text-white">
        <div>
          <Kicker n="05" label="WhatsApp" light />
          <h2 className="display text-5xl sm:text-7xl">Habla.<br /><span className="bg-[#D6FF4A] px-2 text-ink">Pulso</span><br />lo anota.</h2>
          <p className="mt-5 max-w-md text-lg text-white/75">Conecta el WhatsApp de la barbería con un código de 8 caracteres. Confirmaciones y el link de reservas salen de ahí. Si todavía no tienes el servidor, Pulso entra en modo demo y lo dice claro.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="pill bg-white text-ink"><Mic className="h-3.5 w-3.5" /> Por voz</span>
            <span className="pill bg-[#25D366] text-white">WhatsApp</span>
          </div>
        </div>
        <div className="relative">
          <Phone dark>
            <div className="px-4 pt-8 text-center">
              <div className="text-xs uppercase tracking-widest text-white/50">Pulso</div>
              <p className="mt-6 font-display text-3xl font-extrabold uppercase leading-tight">Buenos días.<br />Aquí estoy, cuéntame.</p>
              <div className="mx-auto mt-8 w-14 rounded-full bg-white/10 py-3 text-[10px]">escuchando</div>
            </div>
          </Phone>
          <div className="absolute left-0 top-24 z-20 max-w-[220px] -rotate-2 rounded-2xl border border-white/10 bg-[#2a2150] p-3 text-sm shadow-2xl">
            Buenos días.<br /><span className="text-white/70">Tu cita de las 4 está lista.</span>
          </div>
          <Chispa pose="wave" className="absolute -left-2 bottom-0 z-20 w-32" />
        </div>
      </Slide>

      <section id="precios" className="paper-blue px-5 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <Kicker n="06" label="Precios" light />
          <h2 className="display max-w-3xl text-5xl sm:text-7xl">Empieza<br /><span className="bg-[#D6FF4A] px-2 text-ink">hoy.</span></h2>
          <p className="mt-4 max-w-lg text-white/80">Dos planes. Dólares. Sin letra chica de permanencia.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {PLANS.map((p) => (
              <article key={p.name} className={`rounded-[2rem] p-6 ${p.featured ? "bg-white text-ink" : "bg-ink text-white"}`}>
                <div className="flex items-center justify-between"><span className="pill bg-[#2F5BFF] text-white">{p.name}</span>{p.featured && <span className="pill bg-[#D6FF4A] text-ink">El más pedido</span>}</div>
                <div className="mt-6 flex items-end gap-2"><span className="display text-7xl">US$ {p.price}</span><span className="mb-2 text-sm opacity-60">/ mes</span></div>
                <div className="font-bold">{p.who}</div>
                <ul className="mt-5 space-y-2 text-sm">{p.feats.map((f) => <li key={f} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-[#2F5BFF]" />{f}</li>)}</ul>
                <Link href="/login?modo=registro" className={`mt-6 w-full ${p.featured ? "btn" : "btn-gold"}`}>Crear mi barbería</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="paper px-5 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="display text-5xl">Preguntas<br />claras.</h2>
          <div className="mt-8 divide-y divide-black/10">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-2xl font-extrabold uppercase">
                  {q}<ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180" />
                </summary>
                <p className="mt-2 max-w-xl text-ink/70">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-ink px-5 py-10 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <Logo light />
          <p className="text-sm text-white/60">Agenda, caja y reservas para barberías. Montos en dólares.</p>
          <Link href="/login?modo=registro" className="btn-gold py-2 text-sm">Crear cuenta</Link>
        </div>
      </footer>
    </div>
  );
}
