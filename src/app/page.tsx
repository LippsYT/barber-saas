import Link from "next/link";
import Image from "next/image";
import { Scissors, Calculator, Percent, Link2, BellRing, Check, ChevronDown, Star, ArrowRight, CalendarDays, Wallet } from "lucide-react";

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

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[290px] shrink-0">
      <div className="absolute -inset-10 rounded-full bg-gold/20 blur-3xl" />
      <div className="relative rounded-[2.6rem] border border-white/15 bg-ink-800 p-2.5 shadow-2xl">
        <div className="overflow-hidden rounded-[2.1rem] bg-cream">
          <div className="flex items-center justify-between bg-ink px-5 pb-3 pt-7 text-cream">
            <div><div className="font-display text-base">Barbería Demo</div><div className="text-[10px] text-cream/60">Viernes 30 · Caja abierta</div></div>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gold font-display text-sm text-ink">FD</div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <div className="rounded-xl bg-white p-3 shadow-soft"><div className="text-[10px] text-ink/50">Cobrado hoy</div><div className="font-display text-xl font-semibold">$485.000</div></div>
            <div className="rounded-xl bg-white p-3 shadow-soft"><div className="text-[10px] text-ink/50">Citas</div><div className="font-display text-xl font-semibold">14</div></div>
          </div>
          <div className="space-y-2 px-3">
            {[["9:30", "Carlos", "Corte + barba", "Cobrada"], ["10:20", "Andrés", "Corte clásico", "En curso"], ["11:00", "Carlos", "Barba", "Reservada"]].map(([h, b, s, st]) => (
              <div key={h} className="flex items-center gap-3 rounded-xl bg-white p-2.5 shadow-soft">
                <div className="w-10 text-xs font-semibold tabular-nums">{h}</div>
                <div className="flex-1"><div className="text-xs font-medium">{s}</div><div className="text-[10px] text-ink/50">con {b}</div></div>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${st === "Cobrada" ? "bg-emerald-100 text-emerald-800" : st === "En curso" ? "bg-gold/25 text-gold-700" : "bg-ink/5"}`}>{st}</span>
              </div>))}
          </div>
          <div className="m-3 rounded-xl bg-ink p-3 text-cream">
            <div className="text-[10px] uppercase tracking-widest text-gold">Efectivo esperado</div>
            <div className="mt-1 space-y-0.5 font-mono text-[10px] text-cream/70"><div className="flex justify-between"><span>Fondo inicial</span><span>$50.000</span></div><div className="flex justify-between"><span>+ Ventas efectivo</span><span>$310.000</span></div><div className="flex justify-between"><span>− Gastos</span><span>$12.000</span></div></div>
            <div className="mt-1 flex justify-between border-t border-white/10 pt-1 font-display text-base"><span>Total</span><span className="text-gold-300">$348.000</span></div>
          </div>
          <div className="flex justify-around border-t border-border bg-white py-2.5 text-ink/40"><CalendarDays className="h-4 w-4 text-ink" /><Wallet className="h-4 w-4" /><Calculator className="h-4 w-4" /><Percent className="h-4 w-4" /></div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="bg-ink text-cream">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2 font-display text-xl"><Scissors className="h-5 w-5 text-gold" />Barbería<span className="text-gold">.</span></Link>
          <nav className="hidden gap-8 text-sm text-cream/70 md:flex"><a href="#beneficios" className="hover:text-cream">Beneficios</a><a href="#como" className="hover:text-cream">Cómo funciona</a><a href="#precios" className="hover:text-cream">Precios</a><a href="#faq" className="hover:text-cream">Preguntas</a></nav>
          <div className="flex items-center gap-2"><Link href="/login" className="rounded-lg px-3 py-2 text-sm text-cream/80 hover:text-cream">Entrar</Link><Link href="/login?modo=registro" className="btn-gold py-2 text-sm">Crear mi barbería</Link></div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <Image src="/img/chair.jpg" alt="" fill priority className="object-cover opacity-25" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/80 to-ink" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 md:grid-cols-[1.15fr_1fr] md:py-28">
          <div>
            <div className="eyebrow mb-5 flex items-center gap-2"><span className="h-px w-8 bg-gold" />Software para barberías</div>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] md:text-7xl">Tu barbería,<br /><span className="italic text-gold">en orden.</span></h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-cream/70">Agenda, reservas online por barbero, comisiones automáticas y una caja donde cada número se explica solo. Desde el celular.</p>
            <div className="mt-9 flex flex-wrap gap-3"><Link href="/login?modo=registro" className="btn-gold px-6 py-3.5 text-base">Empieza gratis <ArrowRight className="h-4 w-4" /></Link><Link href="/b/demo" className="inline-flex items-center rounded-lg border border-white/20 px-6 py-3.5 text-base hover:bg-white/5">Ver página de reservas</Link></div>
            <div className="mt-8 flex items-center gap-3 text-sm text-cream/60"><div className="flex text-gold">{[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>Configuración en 5 minutos · Sin tarjeta</div>
          </div>
          <PhoneMockup />
        </div>
      </section>

      <section id="beneficios" className="mx-auto max-w-6xl px-5 py-24">
        <div className="eyebrow">Beneficios</div>
        <h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold md:text-5xl">Menos cuadernos. Más sillas ocupadas.</h2>
        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {BENEFITS.map(({ icon: I, t, d }) => (
            <div key={t} className="group rounded-2xl border border-white/10 bg-white/[.03] p-7 transition hover:border-gold/40 hover:bg-white/[.05]">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-gold/15 text-gold"><I className="h-6 w-6" /></div>
              <h3 className="mt-5 font-display text-2xl">{t}</h3><p className="mt-2 leading-relaxed text-cream/65">{d}</p>
            </div>))}
        </div>
      </section>

      <section className="relative">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 md:grid-cols-3">
          {[["/img/brush.jpg", "Herramientas de oficio"], ["/img/scissors.jpg", "Cada corte, registrado"], ["/img/chair.jpg", "Tu silla, siempre ocupada"]].map(([src, cap]) => (
            <figure key={cap} className="relative h-64 overflow-hidden rounded-2xl"><Image src={src} alt={cap} fill className="object-cover transition duration-700 hover:scale-105" sizes="(min-width:768px) 33vw, 100vw" /><figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink to-transparent p-4 font-display text-lg">{cap}</figcaption></figure>))}
        </div>
      </section>

      <section id="como" className="mx-auto max-w-6xl px-5 py-24">
        <div className="eyebrow">Cómo funciona</div>
        <h2 className="mt-3 font-display text-4xl font-semibold md:text-5xl">Listo antes del primer cliente.</h2>
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {STEPS.map((s) => (<div key={s.n} className="border-t border-gold/40 pt-6"><div className="font-display text-5xl text-gold/80">{s.n}</div><h3 className="mt-4 text-xl font-semibold">{s.t}</h3><p className="mt-2 text-cream/65">{s.d}</p></div>))}
        </div>
      </section>

      <section id="precios" className="border-y border-white/5 bg-ink-800/60">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="text-center"><div className="eyebrow">Precios</div><h2 className="mt-3 font-display text-4xl font-semibold md:text-5xl">Simple y en dólares.</h2><p className="mt-3 text-cream/60">Precio mensual por barbería. Sin costo por reserva ni por cobro.</p></div>
          <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
            {PLANS.map((p) => (
              <div key={p.name} className={`relative rounded-2xl p-8 ${p.featured ? "border border-gold bg-gradient-to-b from-gold/15 to-transparent" : "border border-white/10 bg-white/[.03]"}`}>
                {p.featured && <span className="absolute -top-3 left-8 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-ink">Más elegido</span>}
                <div className="font-display text-2xl">{p.name}</div><div className="text-sm text-cream/60">{p.who}</div>
                <div className="mt-6 flex items-end gap-1"><span className="font-display text-6xl font-semibold">US${p.price}</span><span className="mb-2 text-cream/60">/mes</span></div>
                <ul className="mt-8 space-y-3">{p.feats.map((f) => <li key={f} className="flex gap-3 text-cream/80"><Check className="mt-0.5 h-5 w-5 shrink-0 text-gold" />{f}</li>)}</ul>
                <Link href="/login?modo=registro" className={`mt-8 w-full ${p.featured ? "btn-gold" : "inline-flex items-center justify-center rounded-lg border border-white/20 px-4 py-3 hover:bg-white/5"}`}>Empezar</Link>
              </div>))}
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-5 py-24">
        <div className="eyebrow text-center">Preguntas frecuentes</div>
        <h2 className="mt-3 text-center font-display text-4xl font-semibold">Lo que nos preguntan.</h2>
        <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {FAQ.map(([q, a]) => (<details key={q} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between text-lg font-medium">{q}<ChevronDown className="h-5 w-5 text-gold transition group-open:rotate-180" /></summary><p className="mt-3 leading-relaxed text-cream/65">{a}</p></details>))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-gold/30 px-8 py-16 text-center">
          <Image src="/img/brush.jpg" alt="" fill className="object-cover opacity-20" sizes="100vw" />
          <div className="relative"><h2 className="font-display text-4xl font-semibold md:text-5xl">Abre tu agenda hoy.</h2><p className="mx-auto mt-4 max-w-md text-cream/70">En 5 minutos tienes tu link de reservas listo para compartir.</p><Link href="/login?modo=registro" className="btn-gold mt-8 px-8 py-4 text-base">Crear mi barbería <ArrowRight className="h-4 w-4" /></Link></div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10 text-center text-sm text-cream/40">
        <div className="font-display text-base text-cream/70">Barbería<span className="text-gold">.</span></div>
        <p className="mt-2">Fotos: Skitter Photo y Nick Demou vía StockSnap (CC0).</p>
      </footer>
    </div>
  );
}
