import Link from "next/link";
import { Scissors } from "lucide-react";
export default function L({ children }: { children: React.ReactNode }) {
  return (<div className="min-h-screen bg-ink bg-[radial-gradient(ellipse_at_top,rgba(201,163,92,.18),transparent_60%)] px-4 py-10">
    <Link href="/" className="mx-auto mb-8 flex w-fit items-center gap-2 font-display text-xl text-cream"><Scissors className="h-5 w-5 text-gold" /> Barbería<span className="text-gold">.</span></Link>
    <div className="mx-auto max-w-md rounded-2xl bg-cream-100 p-6 shadow-2xl">{children}</div></div>);
}
