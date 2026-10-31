"use client";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, ExternalLink, Eye, MousePointerClick, Plus, Trash2 } from "lucide-react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { appBaseUrl } from "@/lib/messaging/templates";

const KINDS: [string, string, string][] = [
  ["button", "Botón", "Botón grande con un link (ej. Pedir por WhatsApp)"],
  ["link", "Enlace", "Enlace simple con flecha"],
  ["social", "Red social", "Instagram, TikTok, Facebook…"],
  ["title", "Título", "Separa secciones"],
  ["text", "Texto", "Un párrafo de información"],
  ["hours", "Horario", "Tu horario de atención"],
];
const NEEDS_URL = new Set(["button", "link", "social"]);
interface Block { id: string; kind: string; label: string; url: string | null; sort_order: number; active: boolean }

export default function PulseLink() {
  const { biz, role } = useApp();
  const canEdit = role === "owner" || role === "admin";
  const url = `${appBaseUrl()}/l/${biz.slug}`;
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [enabled, setEnabled] = useState(true); const [headline, setHeadline] = useState("");
  const [stats, setStats] = useState({ views: 0, clicks: 0, byBlock: {} as Record<string, number> });
  const [kind, setKind] = useState("button"); const [label, setLabel] = useState(""); const [link, setLink] = useState("");
  const [err, setErr] = useState(""); const [note, setNote] = useState(""); const [copied, setCopied] = useState(false); const [loaded, setLoaded] = useState(false);

  async function load() {
    const [{ data: b }, { data: p }, { data: ev }] = await Promise.all([
      sb().from("link_blocks").select("*").eq("business_id", biz.id).order("sort_order").order("created_at"),
      sb().from("link_pages").select("*").eq("business_id", biz.id).maybeSingle(),
      sb().from("link_events").select("kind, block_id").eq("business_id", biz.id).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()).limit(20000),
    ]);
    setBlocks((b ?? []) as Block[]);
    if (p) { setEnabled(p.enabled); setHeadline(p.headline ?? ""); }
    const byBlock: Record<string, number> = {}; let views = 0, clicks = 0;
    for (const e of ev ?? []) { if (e.kind === "view") views++; else { clicks++; if (e.block_id) byBlock[e.block_id] = (byBlock[e.block_id] ?? 0) + 1; } }
    setStats({ views, clicks, byBlock }); setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  async function savePage(patch: { enabled?: boolean; headline?: string }) {
    setErr("");
    const next = { business_id: biz.id, enabled: patch.enabled ?? enabled, headline: (patch.headline ?? headline).trim() || null, updated_at: new Date().toISOString() };
    const { error } = await sb().from("link_pages").upsert(next, { onConflict: "business_id" });
    if (error) return setErr(errEs(error));
    if (patch.enabled !== undefined) setEnabled(patch.enabled);
    setNote("Guardado."); setTimeout(() => setNote(""), 1500);
  }
  async function addBlock(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    let u = link.trim();
    if (NEEDS_URL.has(kind)) {
      if (/^@?[\w.]+$/.test(u) && kind === "social") u = `https://instagram.com/${u.replace(/^@/, "")}`;
      else if (u && !/^(https?:\/\/|tel:|mailto:|\/)/i.test(u)) u = `https://${u}`;
      if (!u) return setErr("Pon el link del botón.");
    }
    const sort = blocks.length ? Math.max(...blocks.map((b) => b.sort_order)) + 1 : 0;
    const { error } = await sb().from("link_blocks").insert({ business_id: biz.id, kind, label: label.trim(), url: NEEDS_URL.has(kind) ? u : null, sort_order: sort });
    if (error) return setErr(errEs(error));
    setLabel(""); setLink(""); load();
  }
  async function patch(id: string, p: Partial<Block>) { await sb().from("link_blocks").update(p).eq("id", id); load(); }
  async function remove(b: Block) { if (confirm(`¿Quitar "${b.label}"?`)) { await sb().from("link_blocks").delete().eq("id", b.id); load(); } }
  async function move(i: number, d: -1 | 1) {
    // Renumera toda la lista 0..n-1 con el par intercambiado: evita empates de sort_order.
    const order = blocks.map((b) => b.id);
    [order[i], order[i + d]] = [order[i + d], order[i]];
    await Promise.all(order.map((id, j) => sb().from("link_blocks").update({ sort_order: j }).eq("id", id)));
    load();
  }
  const kindName = (k: string) => KINDS.find((x) => x[0] === k)?.[1] ?? k;
  return (
    <main className="min-w-0 space-y-4">
      <div><div className="eyebrow mb-1">Tu página pública</div><h1 className="h1 !mb-0">Pulse Link</h1></div>
      <p className="text-sm text-ink/60">Un solo enlace para tu bio de Instagram, WhatsApp y tarjetas: reservas, ubicación, redes y lo que quieras mostrar.</p>

      <section className="card space-y-2">
        <div className="font-display text-xl font-extrabold uppercase leading-none">Tu enlace</div>
        <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-ink/[0.04] p-2 pl-3">
          <span className="min-w-0 flex-1 truncate text-sm">{url.replace(/^https?:\/\//, "")}</span>
          <button aria-label="Copiar enlace" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-sm" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* sin portapapeles */ } }}>{copied ? <Check className="h-4 w-4 text-[#14944A]" /> : <Copy className="h-4 w-4" />}</button>
          <a aria-label="Vista previa" href={`/l/${biz.slug}`} target="_blank" rel="noreferrer" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-sm"><ExternalLink className="h-4 w-4" /></a>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-2xl bg-ink p-3 text-white"><div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-[#D6FF4A]"><Eye className="h-3.5 w-3.5" />Visitas · 30 días</div><div className="font-display text-4xl font-extrabold">{stats.views}</div></div>
          <div className="rounded-2xl bg-ink p-3 text-white"><div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-[#D6FF4A]"><MousePointerClick className="h-3.5 w-3.5" />Clics · 30 días</div><div className="font-display text-4xl font-extrabold">{stats.clicks}</div></div>
        </div>
      </section>

      {canEdit && <section className="card space-y-3">
        <label className="flex items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-[#2F5BFF]" checked={enabled} onChange={(e) => savePage({ enabled: e.target.checked })} /><span className="text-sm font-semibold">Página activa (visible al público)</span></label>
        <label className="block"><span className="lbl">Frase corta</span>
          <input className="inp" maxLength={120} placeholder="Ej. Cortes y barba en el centro de Cuenca" value={headline} onChange={(e) => setHeadline(e.target.value)} onBlur={() => savePage({ headline })} /></label>
        {note && <p role="status" className="text-sm text-[#0B5B2B]">{note}</p>}
      </section>}

      <section className="space-y-2">
        <div className="font-display text-2xl font-extrabold uppercase leading-none">Tu contenido</div>
        <p className="text-sm text-ink/60">El botón “Reservar cita” siempre va primero. Lo demás lo ordenas tú.</p>
        {loaded && !blocks.length && <div className="card text-sm text-ink/60">Aún no añadiste nada. Empieza con tu Instagram o un botón de WhatsApp.</div>}
        <ul className="space-y-2">{blocks.map((b, i) => (
          <li key={b.id} className={`card min-w-0 p-3 ${b.active ? "" : "opacity-60"}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1"><span className="pill bg-[#D6FF4A] text-ink">{kindName(b.kind)}</span>
                <div className="mt-1 whitespace-pre-line break-words font-bold">{b.label}</div>
                {b.url && <div className="truncate text-xs text-ink/50">{b.url}</div>}
                {NEEDS_URL.has(b.kind) && <div className="mt-1 text-xs font-semibold text-[#1D3FD6]">{stats.byBlock[b.id] ?? 0} clics</div>}</div>
              {canEdit && <div className="flex shrink-0 flex-col gap-1">
                <button aria-label="Subir" disabled={i === 0} className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 disabled:opacity-30" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
                <button aria-label="Bajar" disabled={i === blocks.length - 1} className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 disabled:opacity-30" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
              </div>}
            </div>
            {canEdit && <div className="mt-2 flex gap-2">
              <button className="btn2 flex-1" onClick={() => patch(b.id, { active: !b.active })}>{b.active ? "Ocultar" : "Mostrar"}</button>
              <button aria-label="Quitar" className="btn2 w-12 text-red-700" onClick={() => remove(b)}><Trash2 className="h-4 w-4" /></button>
            </div>}
          </li>))}
        </ul>
      </section>

      {canEdit && <form onSubmit={addBlock} className="card space-y-3">
        <div className="font-display text-xl font-extrabold uppercase leading-none">Añadir contenido</div>
        <div className="grid grid-cols-2 gap-2">{KINDS.map(([k, name]) => <button key={k} type="button" className={`chip ${kind === k ? "chip-on" : ""}`} onClick={() => setKind(k)}>{name}</button>)}</div>
        <p className="text-xs text-ink/55">{KINDS.find((k) => k[0] === kind)?.[2]}</p>
        <label className="block"><span className="lbl">{kind === "text" ? "Texto" : kind === "hours" ? "Horario (una línea por día)" : "Nombre"}</span>
          {kind === "text" || kind === "hours" ? <textarea className="inp min-h-[96px]" required maxLength={200} value={label} onChange={(e) => setLabel(e.target.value)} />
            : <input className="inp" required maxLength={80} placeholder={kind === "social" ? "Instagram" : kind === "title" ? "Nuestros servicios" : "Pedir por WhatsApp"} value={label} onChange={(e) => setLabel(e.target.value)} />}</label>
        {NEEDS_URL.has(kind) && <label className="block"><span className="lbl">Link</span><input className="inp" inputMode="url" autoCapitalize="none" placeholder={kind === "social" ? "@tubarberia o https://…" : "https://wa.me/593999111222"} value={link} onChange={(e) => setLink(e.target.value)} /></label>}
        <button className="btn w-full"><Plus className="h-4 w-4" />Añadir</button>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      </form>}
    </main>
  );
}
