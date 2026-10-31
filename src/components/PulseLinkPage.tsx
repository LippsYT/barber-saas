"use client";
import { useEffect } from "react";
import { AtSign, CalendarCheck, Clock, ExternalLink, MapPin, Phone as PhoneIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { sb } from "@/lib/supabase";
import { Logo } from "@/components/brand/Logo";

export interface LinkBlock { id: string; kind: "button" | "link" | "social" | "text" | "title" | "hours"; label: string; url: string | null }
export interface LinkPageData {
  business: { name: string; slug: string; cover_url?: string | null; address?: string | null; phone?: string | null };
  headline?: string | null;
  blocks: LinkBlock[];
}

const track = (slug: string, kind: "view" | "click", block?: string) =>
  Promise.resolve(sb().rpc("public_track_link", { p_slug: slug, p_kind: kind, p_block: block ?? null })).catch(() => {});

export function PulseLinkPage({ data, preview = false }: { data: LinkPageData; preview?: boolean }) {
  const reduce = useReducedMotion();
  const { business: b } = data;
  useEffect(() => { if (!preview) track(b.slug, "view"); }, [b.slug, preview]);

  async function go(e: React.MouseEvent<HTMLAnchorElement>, id?: string) {
    if (preview) { e.preventDefault(); return; }
    const a = e.currentTarget, ext = a.target === "_blank";
    if (!ext) e.preventDefault();
    await Promise.race([track(b.slug, "click", id), new Promise((r) => setTimeout(r, 450))]);
    if (!ext) location.href = a.href;
  }
  const cls = "flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-center font-bold transition active:scale-[.98]";
  const item = (i: number) => ({ initial: reduce ? false : { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] as const } });
  return (
    <main className="paper-blue min-h-screen px-4 pb-[calc(3rem+var(--sab))] pt-[calc(2rem+var(--sat))] text-white">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <motion.div {...item(0)} className="flex flex-col items-center">
          {b.cover_url ? <img src={b.cover_url} alt="" className="h-28 w-28 rounded-full object-cover ring-4 ring-white" />
            : <div className="grid h-28 w-28 place-items-center rounded-full bg-[#D6FF4A] font-display text-5xl font-extrabold text-ink ring-4 ring-white">{b.name.slice(0, 1).toUpperCase()}</div>}
          <h1 className="display mt-4 break-words text-5xl">{b.name}</h1>
          {data.headline && <p className="mt-2 max-w-xs text-white/85">{data.headline}</p>}
          {b.address && <p className="mt-2 flex items-start gap-1 text-sm text-white/75"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{b.address}</p>}
        </motion.div>

        <div className="mt-6 w-full space-y-3">
          <motion.div {...item(1)}><a href={`/${b.slug}`} onClick={(e) => go(e)} className={`${cls} bg-[#D6FF4A] text-ink shadow-[0_10px_30px_rgba(214,255,74,.35)]`}><CalendarCheck className="h-5 w-5" />Reservar cita</a></motion.div>
          {data.blocks.map((k, i) => (
            <motion.div key={k.id} {...item(i + 2)}>
              {k.kind === "title" && <h2 className="display pt-3 text-3xl">{k.label}</h2>}
              {k.kind === "text" && <p className="rounded-3xl bg-white/10 p-4 text-left text-sm text-white/90">{k.label}</p>}
              {k.kind === "hours" && <div className="rounded-3xl bg-white p-4 text-left text-ink"><div className="mb-1 flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-ink/50"><Clock className="h-4 w-4" />Horario</div><p className="whitespace-pre-line text-sm font-semibold">{k.label}</p></div>}
              {k.kind === "button" && k.url && <a href={k.url} target={k.url.startsWith("/") ? undefined : "_blank"} rel="noreferrer" onClick={(e) => go(e, k.id)} className={`${cls} bg-white text-ink`}>{k.label}</a>}
              {k.kind === "link" && k.url && <a href={k.url} target={k.url.startsWith("/") ? undefined : "_blank"} rel="noreferrer" onClick={(e) => go(e, k.id)} className={`${cls} border border-white/40 bg-white/10`}>{k.label}<ExternalLink className="h-4 w-4 opacity-70" /></a>}
              {k.kind === "social" && k.url && <a href={k.url} target="_blank" rel="noreferrer" onClick={(e) => go(e, k.id)} className={`${cls} bg-ink text-white`}>{/instagram/i.test(k.url) ? <AtSign className="h-5 w-5" /> : <ExternalLink className="h-5 w-5" />}{k.label}</a>}
            </motion.div>))}
          {b.phone && <motion.div {...item(data.blocks.length + 2)}><a href={`tel:${b.phone}`} onClick={(e) => go(e)} className={`${cls} border border-white/40`}><PhoneIcon className="h-4 w-4" />Llamar</a></motion.div>}
        </div>
        <div className="mt-10 text-xs text-white/70">Hecho con <Logo light className="!text-base align-middle [&_svg]:!h-4 [&_svg]:!w-4" /></div>
      </div>
    </main>
  );
}
