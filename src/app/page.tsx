import Link from "next/link";
import Image from "next/image";
import { Scissors, Calculator, Percent, Link2, BellRing, Check, ChevronDown, Star, ArrowRight } from "lucide-react";
import { HeroVisual } from "@/components/hero/HeroVisual";
import { MotionRoot, Reveal } from "@/components/motion/Reveal";

const BENEFITS = [
  { icon: Calculator, t: "Caja que se explica sola", d: "Cada número tiene su “ver cálculo”: fondo, ventas, gastos y anulaciones, línea por línea. Cierras en un minuto y sabes por qué cuadra." },
  { icon: Percent, t: "Comisiones automáticas", d: "Reglas por negocio, barbero o servicio. Al cobrar se calcula la comisión y la propina de cada barbero, sin hojas de cálculo." },
  { icon: Link2, t: "Link de reserva por barbero", d: "Un enlace para la barbería y uno para cada barbero. Tus clientes reservan solos, 24/7, desde Instagram o WhatsApp." },
  { icon: BellRing, t: "Recordatorios", d: "Tus clientes aceptan recordatorios por WhatsApp al reservar y pueden cancelar desde su enlace: menos sillas vacías." },
];
const STEPS = [
  { n: "01", t: "Crea tu barbería", d: "Nombre, servicios y precios. Tu equipo entra con su correo." },
  { n: "02", t: "Comparte tu link", d: "Pégalo en tu bio de Instagram y en WhatsApp. Las citas caen en la agenda." },
  { n: "03", t: "Cobra y cierra caja", d: "Efectivo, tarjeta o transferencia, incluso dividido. Al final del día, la caja cuadra sola." },
];
const PLANS = [
  { name: "Barbería", price: 19, who: "Hasta 3 barberos", feats: ["Agenda y link de reservas", "Link por barbero", "Caja con cierre explicado", "Comisiones automáticas", "Reportes por empleado"] },
  { name: "Barbería Pro", price: 39, who: "Hasta 10 barberos", feats: ["Todo lo del plan Barbería", "Roles: admin y recepción", "Libro de caja con anulaciones", "Límites de gastos por rol", "Soporte prioritario"], featured: true },
];
const FAQ = [
  ["¿Necesito instalar algo?", "No. Funciona desde el navegador del celular o del computador. Puedes agregarlo a tu pantalla de inicio."],
  ["¿Mis clientes necesitan cuenta para reservar?", "No. Solo eligen día, barbero, servicio y horario, y dejan su nombre y WhatsApp."],
  ["¿Cómo se calculan las comisiones?", "Defines un porcentaje para el negocio, para cada barbero o para cada servicio. En cada cobro puedes abrir “ver cálculo” y ver la cuenta exacta."],
  ["¿Puedo borrar una venta equivocada?", "Nada se borra: se anula con un asiento inverso y un motivo. Así la caja siempre tiene historia y nadie puede maquillar números."],
  ["¿Puedo cancelar cuando quiera?", "Sí. Sin contratos ni permanencia."],
];
const TICKER = ["Agenda del día", "Reservas por WhatsApp", "Caja explicada", "Comisiones", "Link por barbero", "Cierre en un minuto"];

export default function Home() {
  return (
    <MotionRoot>
      <div className="bg-ink text-cream">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-gold focus:px-3 focus:py-2 focus:text-ink">Saltar al contenido</a>
        <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
            <Link href="/" className="flex items-center gap-2 font-display text-xl">
              <Scissors className="h-5 w-5 text-gold" />
              Barbería<span className="text-gold">.</span>
            </Link>
            <nav className="hidden gap-8 text-sm text-cream/70 md:flex">
              <a href="#beneficios" className="transition hover:text-cream">Beneficios</a>
              <a href="#como" className="transition hover:text-cream">Cómo funciona</a>
              <a href="#precios" className="transition hover:text-cream">Precios</a>
              <a href="#faq" className="transition hover:text-cream">Preguntas</a>
            </nav>
            <div className="flex items-center gap-2">
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm text-cream/80 transition hover:text-cream">Entrar</Link>
              <Link href="/login?modo=registro" className="btn-gold whitespace-nowrap py-2 text-sm">
                <span className="sm:hidden">Empezar</span>
                <span className="hidden sm:inline">Crear mi barbería</span>
              </Link>
            </div>
          </div>
        </header>

        <section id="contenido" className="grain relative overflow-hidden">
          <Image src="/img/chair.jpg" alt="" fill priority className="object-cover opacity-30" sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/55 via-ink/78 to-ink" />
          <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_70%_45%,rgba(201,163,92,.22),transparent_58%)] md:block" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:min-h-[calc(100svh-64px)] md:grid-cols-[1.05fr_.95fr] md:py-20">
            <div>
              <div className="eyebrow mb-5 flex items-center gap-2 text-gold"><span className="h-px w-8 bg-gold" />Software para barberías</div>
              <h1 className="font-display text-[3.1rem] font-semibold leading-[0.98] sm:text-6xl md:text-7xl">
                Tu barbería,<br /><span className="italic text-gold">en orden.</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-cream/75">Agenda, reservas online por barbero, comisiones automáticas y una caja donde cada número se explica solo. Desde el celular.</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/login?modo=registro" className="btn-gold px-6 py-3.5 text-base">Empieza gratis <ArrowRight className="h-4 w-4" /></Link>
                <Link href="/demo" className="inline-flex items-center rounded-lg border border-white/20 px-6 py-3.5 text-base transition hover:border-gold/50 hover:bg-white/5">Ver página de reservas</Link>
              </div>
              <div className="mt-8 flex items-center gap-3 text-sm text-cream/60">
                <div className="flex text-gold" aria-hidden>{[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
                Configuración en 5 minutos · Sin tarjeta
              </div>
            </div>
            <HeroVisual />
          </div>
        </section>

        <div className="overflow-hidden border-y border-white/10 bg-ink-800/80 py-3" aria-hidden>
          <div className="ticker-track gap-8">
            {[...TICKER, ...TICKER].map((item, i) => (
              <span key={`${item}-${i}`} className="flex items-center gap-8 text-xs font-semibold uppercase tracking-[0.22em] text-cream/55">
                {item}<span className="text-gold">✦</span>
              </span>
            ))}
          </div>
        </div>

        <section id="beneficios" className="mx-auto max-w-6xl px-5 py-24">
          <Reveal>
            <div className="eyebrow">Beneficios</div>
            <h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold md:text-5xl">Menos cuadernos. Más sillas ocupadas.</h2>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2">
            {BENEFITS.map(({ icon: I, t, d }, i) => (
              <Reveal key={t} delay={i * 0.08}>
                <article className="group h-full rounded-2xl border border-white/10 bg-white/[.03] p-7 transition duration-300 hover:-translate-y-1 hover:border-gold/50 hover:bg-white/[.06]">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-gold/15 text-gold transition duration-300 group-hover:scale-105 group-hover:bg-gold group-hover:text-ink">
                    <I className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 font-display text-2xl">{t}</h3>
                  <p className="mt-2 leading-relaxed text-cream/65">{d}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="relative">
          <div className="mx-auto grid max-w-6xl gap-4 px-5 md:grid-cols-3">
            {[["/img/brush.jpg", "Herramientas de oficio"], ["/img/scissors.jpg", "Cada corte, registrado"], ["/img/chair.jpg", "Tu silla, siempre ocupada"]].map(([src, cap], i) => (
              <Reveal key={cap} delay={i * 0.06}>
                <figure className="group relative h-64 overflow-hidden rounded-2xl">
                  <Image src={src} alt={cap} fill className="object-cover transition duration-700 group-hover:scale-105" sizes="(min-width:768px) 33vw, 100vw" />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/70 to-transparent p-4 font-display text-lg">{cap}</figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="como" className="mx-auto max-w-6xl px-5 py-24">
          <Reveal>
            <div className="eyebrow">Cómo funciona</div>
            <h2 className="mt-3 font-display text-4xl font-semibold md:text-5xl">Listo antes del primer cliente.</h2>
          </Reveal>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="border-t border-gold/50 pt-6">
                  <div className="font-display text-5xl text-gold/80">{s.n}</div>
                  <h3 className="mt-4 text-xl font-semibold">{s.t}</h3>
                  <p className="mt-2 text-cream/65">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="precios" className="border-y border-white/5 bg-ink-800/60">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <Reveal className="text-center">
              <div className="eyebrow">Precios</div>
              <h2 className="mt-3 font-display text-4xl font-semibold md:text-5xl">Simple y en dólares.</h2>
              <p className="mt-3 text-cream/60">Precio mensual por barbería. Sin costo por reserva ni por cobro.</p>
            </Reveal>
            <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
              {PLANS.map((p, i) => (
                <Reveal key={p.name} delay={i * 0.08}>
                  <article className={`relative h-full rounded-2xl p-8 transition duration-300 hover:-translate-y-1 ${p.featured ? "border border-gold bg-gradient-to-b from-gold/20 to-transparent shadow-[0_20px_60px_rgba(201,163,92,.12)]" : "border border-white/10 bg-white/[.03]"}`}>
                    {p.featured && <span className="absolute -top-3 left-8 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-ink">Más elegido</span>}
                    <div className="font-display text-2xl">{p.name}</div>
                    <div className="text-sm text-cream/60">{p.who}</div>
                    <div className="mt-6 flex items-end gap-1">
                      <span className="font-display text-6xl font-semibold">US${p.price}</span>
                      <span className="mb-2 text-cream/60">/mes</span>
                    </div>
                    <ul className="mt-8 space-y-3">
                      {p.feats.map((f) => (
                        <li key={f} className="flex gap-3 text-cream/80"><Check className="mt-0.5 h-5 w-5 shrink-0 text-gold" />{f}</li>
                      ))}
                    </ul>
                    <Link href="/login?modo=registro" className={`mt-8 w-full ${p.featured ? "btn-gold" : "inline-flex items-center justify-center rounded-lg border border-white/20 px-4 py-3 transition hover:border-gold/40 hover:bg-white/5"}`}>Empezar</Link>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-5 py-24">
          <Reveal>
            <div className="eyebrow text-center">Preguntas frecuentes</div>
            <h2 className="mt-3 text-center font-display text-4xl font-semibold">Lo que nos preguntan.</h2>
          </Reveal>
          <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium">
                  {q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-gold transition duration-300 group-open:rotate-180" />
                </summary>
                <p className="mt-3 leading-relaxed text-cream/65">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-gold/40 px-8 py-16 text-center">
              <Image src="/img/brush.jpg" alt="" fill className="object-cover opacity-25" sizes="100vw" />
              <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/70" />
              <div className="relative">
                <h2 className="font-display text-4xl font-semibold md:text-5xl">Abre tu agenda hoy.</h2>
                <p className="mx-auto mt-4 max-w-md text-cream/75">En 5 minutos tienes tu link de reservas listo para compartir.</p>
                <Link href="/login?modo=registro" className="btn-gold mt-8 px-8 py-4 text-base">Crear mi barbería <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
          </Reveal>
        </section>

        <footer className="border-t border-white/5 py-10 text-center text-sm text-cream/40">
          <div className="font-display text-base text-cream/70">Barbería<span className="text-gold">.</span></div>
          <p className="mt-2">Fotos: Skitter Photo y Nick Demou vía StockSnap (CC0).</p>
        </footer>
      </div>
    </MotionRoot>
  );
}
