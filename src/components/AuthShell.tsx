import Image from "next/image";
import Link from "next/link";
import { Scissors } from "lucide-react";

export function AuthShell({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink text-cream md:grid md:grid-cols-2">
      <div className="relative hidden overflow-hidden md:block">
        <Image src="/img/chair.jpg" alt="" fill className="object-cover opacity-55" sizes="50vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/75 to-ink/25" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex w-fit items-center gap-2 font-display text-2xl">
            <Scissors className="h-5 w-5 text-gold" />
            Barbería<span className="text-gold">.</span>
          </Link>
          <div>
            <div className="eyebrow text-gold">{kicker}</div>
            <p className="mt-4 max-w-md font-display text-5xl font-semibold leading-[1.05]">{title}</p>
          </div>
        </div>
      </div>
      <div className="relative flex min-h-screen flex-col justify-center px-4 py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,163,92,.2),transparent_55%)]" />
        <Link href="/" className="relative mx-auto mb-8 flex w-fit items-center gap-2 font-display text-xl md:hidden">
          <Scissors className="h-5 w-5 text-gold" />
          Barbería<span className="text-gold">.</span>
        </Link>
        <div className="rise relative mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-cream-100 p-6 text-ink shadow-2xl md:p-8">{children}</div>
      </div>
    </div>
  );
}
