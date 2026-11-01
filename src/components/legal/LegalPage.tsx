import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LEGAL_UPDATED, SUPPORT_PHONE, supportLink } from "@/lib/legal";

/** Marco común de Términos, Privacidad y Soporte. */
export function LegalPage({ title, intro, updated = true, children }: { title: string; intro?: string; updated?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 py-5"><Link href="/" aria-label="Pulso, inicio"><Logo /></Link><Link href="/login" className="text-sm font-bold underline">Entrar</Link></header>
      <main className="mx-auto max-w-2xl px-5 pb-16 pt-2">
        <h1 className="font-display text-4xl font-extrabold uppercase leading-none">{title}</h1>
        {updated && <p className="mt-2 text-xs text-ink/55">Última actualización: {LEGAL_UPDATED}</p>}
        {intro && <p className="mt-4 text-base text-ink/80">{intro}</p>}
        <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-ink/85 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:uppercase [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1">{children}</div>
      </main>
      <footer className="border-t border-black/10 px-5 py-6 text-center text-xs text-ink/60">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-bold"><Link href="/terminos">Términos</Link><Link href="/privacidad">Privacidad</Link><Link href="/soporte">Soporte</Link></nav>
        <p className="mt-2">¿Dudas? Escríbenos por <a className="underline" href={supportLink()} target="_blank" rel="noopener noreferrer">WhatsApp al {SUPPORT_PHONE}</a>.</p>
      </footer>
    </div>
  );
}
