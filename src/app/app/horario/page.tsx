"use client";
import { useEffect, useState } from "react";
import { CalendarOff, Trash2 } from "lucide-react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { localDate } from "@/lib/time";

type Day = { weekday: number; is_open: boolean; start: string; end: string };
type Special = { id: string; on_date: string; closed: boolean; start_time: string | null; end_time: string | null; note: string | null };
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const NAME = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const hm = (t: string | null) => (t ?? "").slice(0, 5);
const blank = (): Day[] => Array.from({ length: 7 }, (_, weekday) => ({ weekday, is_open: weekday !== 0, start: "09:00", end: "19:00" }));

export default function Horario() {
  const { biz, isManager } = useApp();
  const [days, setDays] = useState<Day[]>(blank()); const [saved, setSaved] = useState(false);
  const [specials, setSpecials] = useState<Special[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [note, setNote] = useState("");
  const [sp, setSp] = useState({ on_date: "", closed: true, start: "10:00", end: "14:00", note: "" });
  const today = localDate(Date.now(), biz.timezone);

  const load = async () => {
    const [{ data: h }, { data: s }] = await Promise.all([
      sb().from("business_hours").select("weekday,is_open,start_time,end_time").eq("business_id", biz.id),
      sb().from("special_days").select("id,on_date,closed,start_time,end_time,note").eq("business_id", biz.id).gte("on_date", today).order("on_date"),
    ]);
    if (h?.length) { setSaved(true); setDays(blank().map((d) => { const r = h.find((x: any) => x.weekday === d.weekday); return r ? { weekday: d.weekday, is_open: r.is_open, start: hm(r.start_time), end: hm(r.end_time) } : d; })); }
    setSpecials((s ?? []) as Special[]);
  };
  useEffect(() => { load(); }, []);

  const patch = (w: number, p: Partial<Day>) => setDays(days.map((d) => (d.weekday === w ? { ...d, ...p } : d)));
  async function save() {
    setErr(""); setNote("");
    const bad = days.find((d) => d.is_open && d.end <= d.start);
    if (bad) return setErr(`${NAME[bad.weekday]}: la hora de cierre debe ser después de la de apertura.`);
    setBusy(true);
    const { error } = await sb().from("business_hours").upsert(days.map((d) => ({ business_id: biz.id, weekday: d.weekday, is_open: d.is_open, start_time: d.start, end_time: d.end })), { onConflict: "business_id,weekday" });
    setBusy(false);
    if (error) return setErr(errEs(error));
    setSaved(true); setNote("Horario guardado. Ya limita los horarios que ven tus clientes.");
  }
  async function addSpecial(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setNote("");
    if (!sp.on_date) return setErr("Elige la fecha.");
    if (!sp.closed && sp.end <= sp.start) return setErr("La hora de cierre debe ser después de la de apertura.");
    const { error } = await sb().from("special_days").upsert({ business_id: biz.id, on_date: sp.on_date, closed: sp.closed, start_time: sp.closed ? null : sp.start, end_time: sp.closed ? null : sp.end, note: sp.note.trim() || null }, { onConflict: "business_id,on_date" });
    if (error) return setErr(errEs(error));
    setSp({ ...sp, on_date: "", note: "" }); load();
  }
  async function removeSpecial(id: string) { await sb().from("special_days").delete().eq("id", id); load(); }

  return (
    <main className="min-w-0 space-y-4">
      <div><div className="eyebrow mb-1">Cuándo atiendes</div><h1 className="h1 !mb-0">Horario del negocio</h1></div>
      <p className="text-sm text-ink/60">Tus clientes solo podrán reservar dentro de este horario, además del horario de cada barbero.</p>
      {!saved && <p role="status" className="rounded-2xl bg-[#D6FF4A]/60 p-3 text-sm font-semibold">Todavía no guardaste un horario: hoy solo cuenta el horario de cada barbero.</p>}

      <section className="card space-y-2 p-3">
        {ORDER.map((w) => { const d = days.find((x) => x.weekday === w)!; return (
          <div key={w} className="min-w-0 rounded-2xl bg-ink/[0.04] p-3">
            <label className="flex items-center justify-between gap-3"><span className="font-bold">{NAME[w]}</span>
              <span className="flex items-center gap-2 text-xs font-semibold text-ink/60">{d.is_open ? "Abierto" : "Cerrado"}<input type="checkbox" className="h-6 w-11 accent-[#2F5BFF]" checked={d.is_open} disabled={!isManager} onChange={(e) => patch(w, { is_open: e.target.checked })} aria-label={`${NAME[w]} abierto`} /></span></label>
            {d.is_open && <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="min-w-0"><span className="lbl">Desde</span><input type="time" className="inp" value={d.start} disabled={!isManager} onChange={(e) => patch(w, { start: e.target.value })} /></label>
              <label className="min-w-0"><span className="lbl">Hasta</span><input type="time" className="inp" value={d.end} disabled={!isManager} onChange={(e) => patch(w, { end: e.target.value })} /></label>
            </div>}
          </div>); })}
        {isManager && <button className="btn w-full" disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar horario"}</button>}
        {note && <p role="status" className="text-sm text-[#0B5B2B]">{note}</p>}
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      </section>

      <section className="card space-y-3">
        <div className="flex items-center gap-2 font-display text-xl font-extrabold uppercase leading-none"><CalendarOff className="h-5 w-5" />Días especiales</div>
        <p className="text-sm text-ink/60">Feriados, vacaciones o un día con otro horario. Mandan sobre el horario semanal.</p>
        {isManager && <form onSubmit={addSpecial} className="space-y-2">
          <label className="block min-w-0"><span className="lbl">Fecha</span><input type="date" className="inp" min={today} value={sp.on_date} onChange={(e) => setSp({ ...sp, on_date: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-[#2F5BFF]" checked={sp.closed} onChange={(e) => setSp({ ...sp, closed: e.target.checked })} />Cerrado todo el día</label>
          {!sp.closed && <div className="grid grid-cols-2 gap-2">
            <label className="min-w-0"><span className="lbl">Desde</span><input type="time" className="inp" value={sp.start} onChange={(e) => setSp({ ...sp, start: e.target.value })} /></label>
            <label className="min-w-0"><span className="lbl">Hasta</span><input type="time" className="inp" value={sp.end} onChange={(e) => setSp({ ...sp, end: e.target.value })} /></label>
          </div>}
          <input className="inp" maxLength={120} placeholder="Motivo (opcional)" value={sp.note} onChange={(e) => setSp({ ...sp, note: e.target.value })} />
          <button className="btn2 w-full">Agregar día especial</button>
        </form>}
        {!specials.length && <p className="text-sm text-ink/50">No hay días especiales próximos.</p>}
        <ul className="space-y-2">{specials.map((s) => (
          <li key={s.id} className="flex min-w-0 items-center justify-between gap-2 rounded-2xl bg-ink/[0.04] p-3 text-sm">
            <div className="min-w-0"><div className="font-bold">{new Date(s.on_date + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</div>
              <div className="text-xs text-ink/60">{s.closed ? "Cerrado" : `${hm(s.start_time)} – ${hm(s.end_time)}`}{s.note ? ` · ${s.note}` : ""}</div></div>
            {isManager && <button aria-label="Quitar día especial" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-sm" onClick={() => removeSpecial(s.id)}><Trash2 className="h-4 w-4 text-red-600" /></button>}
          </li>))}</ul>
      </section>
    </main>
  );
}
