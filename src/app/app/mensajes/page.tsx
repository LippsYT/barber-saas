"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CalendarCheck, CalendarX, ChevronDown, FileText, Repeat, Star } from "lucide-react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";

type Key = "confirmation" | "reminder24" | "reminder2" | "cancellation" | "review";
type Settings = { messages?: Partial<Record<Key, boolean>>; messages_text?: Partial<Record<string, string>>; review_url?: string; weekly_report?: boolean };

const CARDS: { key: Key; title: string; hint: string; icon: typeof Bell; defOn: boolean; editable: boolean; def?: string }[] = [
  { key: "confirmation", title: "Confirmación de cita", hint: "Al crear una cita.", icon: CalendarCheck, defOn: true, editable: true,
    def: "¡Hola @nombre_cliente! Tu cita en @nombre_del_negocio quedó confirmada.\n📅 @fecha_reserva\n✂️ @servicios con @barbero" },
  { key: "reminder24", title: "Recordatorio 24 horas antes", hint: "Un día antes de la cita.", icon: Bell, defOn: true, editable: true,
    def: "⏰ @nombre_cliente, mañana tienes cita en @nombre_del_negocio.\n📅 @fecha_reserva\n✂️ @servicios con @barbero" },
  { key: "reminder2", title: "Recordatorio 2 horas antes", hint: "Poco antes de la cita.", icon: Bell, defOn: true, editable: true,
    def: "⏰ @nombre_cliente, tu cita es en 2 horas.\n📅 @fecha_reserva con @barbero" },
  { key: "cancellation", title: "Aviso de cancelación", hint: "Cuando se cancela una cita.", icon: CalendarX, defOn: true, editable: false },
  { key: "review", title: "Solicitud de reseña", hint: "2 horas después de atender. Necesita el enlace de tus reseñas.", icon: Star, defOn: false, editable: false },
];
const FIELDS = ["@nombre_cliente", "@nombre_del_negocio", "@fecha_reserva", "@barbero", "@servicios", "@total"];
const SAMPLE: Record<string, string> = { "@nombre_cliente": "Carlos", "@nombre_del_negocio": "tu barbería", "@fecha_reserva": "Sábado 31 de octubre, 10:10 a. m.", "@barbero": "Andrés", "@servicios": "Corte clásico", "@total": "US$ 10,00" };
const preview = (t: string) => Object.entries(SAMPLE).reduce((a, [k, v]) => a.split(k).join(v), t);

export default function Mensajes() {
  const { biz, isManager } = useApp();
  const [st, setSt] = useState<Settings | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [draft, setDraft] = useState("");
  const [review, setReview] = useState(""); const [err, setErr] = useState(""); const [note, setNote] = useState("");

  const load = async () => { const { data } = await sb().from("businesses").select("settings").eq("id", biz.id).single(); const s = (data?.settings ?? {}) as Settings; setSt(s); setReview(s.review_url ?? ""); };
  useEffect(() => { load(); }, []);
  async function save(patch: object, ok = "Guardado.") {
    setErr(""); setNote("");
    const { data, error } = await sb().rpc("set_business_settings", { p_patch: patch });
    if (error) return setErr(errEs(error));
    setSt(data as Settings); setNote(ok);
  }
  const [sending, setSending] = useState(false);
  async function sendNow() {
    setSending(true); setErr(""); setNote("");
    try {
      const r = await fetch("/api/report", { method: "POST" }); const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j.error || "No se pudo enviar el informe."); else setNote(`Informe enviado a ${j.to}. Revisa también la carpeta de spam.`);
    } catch { setErr("No se pudo enviar el informe."); }
    setSending(false);
  }
  const on = (c: (typeof CARDS)[number]) => st?.messages?.[c.key] ?? c.defOn;

  if (!st) return <main className="card text-sm text-ink/60">Cargando…</main>;
  return (
    <main className="min-w-0 space-y-4">
      <div><div className="eyebrow mb-1">WhatsApp</div><h1 className="h1 !mb-0">Mensajes automáticos</h1></div>
      <p className="text-sm text-ink/60">Elige qué avisos salen solos. Los clientes que aceptaron recibir WhatsApp los reciben desde tu número conectado.</p>
      {note && <p role="status" className="text-sm text-[#0B5B2B]">{note}</p>}
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}

      <div className="space-y-2">{CARDS.map((c) => { const Icon = c.icon, isOn = on(c), isOpen = open === c.key, custom = st.messages_text?.[c.key]; return (
        <section key={c.key} className="card min-w-0 p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2F5BFF]/10 text-[#2F5BFF]"><Icon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><div className="font-bold">{c.title}</div><div className="text-xs text-ink/55">{c.hint}</div></div>
            <input type="checkbox" className="h-6 w-11 shrink-0 accent-[#2F5BFF]" aria-label={c.title} checked={isOn} disabled={!isManager} onChange={(e) => save({ messages: { [c.key]: e.target.checked } })} />
          </div>
          {c.editable && isManager && <button className="mt-2 inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-[#1D3FD6]" aria-expanded={isOpen}
            onClick={() => { setOpen(isOpen ? null : c.key); setDraft(custom || c.def || ""); }}>{custom ? "Editar mi mensaje" : "Personalizar mensaje"} <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} /></button>}
          {isOpen && <div className="mt-2 space-y-2">
            <textarea className="inp min-h-[120px]" maxLength={600} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="flex flex-wrap gap-1.5">{FIELDS.map((f) => <button key={f} type="button" className="pill bg-ink/[0.06]" onClick={() => setDraft((d) => d + (d && !d.endsWith(" ") && !d.endsWith("\n") ? " " : "") + f)}>{f}</button>)}</div>
            <div className="rounded-2xl bg-[#E9F7EC] p-3 text-sm"><div className="mb-1 text-[11px] font-extrabold uppercase tracking-widest text-[#0B5B2B]">Vista previa</div><p className="whitespace-pre-wrap break-words">{preview(draft) || "—"}</p><p className="mt-2 text-xs text-ink/55">Siempre se añade al final el enlace para ver o cancelar la cita.</p></div>
            <div className="flex gap-2"><button className="btn flex-1" onClick={() => draft.trim() ? save({ messages_text: { [c.key]: draft.trim() } }, "Mensaje guardado.") : null}>Guardar mensaje</button>
              <button className="btn2" onClick={() => { save({ messages_text: { [c.key]: null } }, "Volvimos al mensaje original."); setOpen(null); }}>Restablecer</button></div>
          </div>}
          {c.key === "review" && isManager && <div className="mt-2 space-y-2">
            <label className="block min-w-0"><span className="lbl">Enlace de tus reseñas de Google</span><input className="inp" inputMode="url" placeholder="https://g.page/r/…" value={review} onChange={(e) => setReview(e.target.value)} /></label>
            <button className="btn2 w-full" onClick={() => save({ review_url: review.trim() }, "Enlace de reseñas guardado.")}>Guardar enlace</button>
          </div>}
        </section>); })}</div>

      <Link href="/app/whatsapp" className="card flex items-center gap-3 p-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2F5BFF]/10 text-[#2F5BFF]"><Repeat className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className="block font-bold">Reactivación de clientes</span><span className="block text-xs text-ink/55">Invita a volver a quien lleva tiempo sin venir. Se configura en WhatsApp.</span></span></Link>

      <section className="card flex items-center gap-3 p-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2F5BFF]/10 text-[#2F5BFF]"><FileText className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className="block font-bold">Informe semanal por email</span><span className="block text-xs text-ink/55">Un PDF con tus ventas, gastos y citas, cada lunes, al correo del dueño.</span></span>
        <input type="checkbox" className="h-6 w-11 shrink-0 accent-[#2F5BFF]" aria-label="Informe semanal" checked={Boolean(st.weekly_report)} disabled={!isManager} onChange={(e) => save({ weekly_report: e.target.checked })} /></section>
      {isManager && <button className="btn2 w-full" disabled={sending} onClick={sendNow}>{sending ? "Enviando…" : "Enviarme el informe de la semana pasada ahora"}</button>}
    </main>
  );
}
