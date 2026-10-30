import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Chispa } from "@/components/brand/Mascot";

export function AuthShell({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink text-white md:grid md:grid-cols-2">
      <div className="paper-blue relative hidden overflow-hidden md:block">
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/"><Logo light /></Link>
          <Chispa pose="run" className="w-56" />
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/70">{kicker}</div>
            <p className="mt-3 max-w-md font-display text-6xl font-extrabold uppercase leading-[0.88]">{title}</p>
          </div>
        </div>
      </div>
      <div className="relative flex min-h-screen flex-col justify-center bg-[#F4F1E8] px-4 py-10 text-ink">
        <Link href="/" className="relative mx-auto mb-8 md:hidden"><Logo /></Link>
        <div className="relative mx-auto w-full max-w-md rounded-[2rem] bg-white p-6 shadow-soft md:p-8">{children}</div>
      </div>
    </div>
  );
}
