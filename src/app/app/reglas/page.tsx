"use client";
import { useEffect, useState } from "react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";

type S = { min_notice_min?: number; max_advance_days?: number; slot_step_min?: number; cancel_notice_min?: number };
const MIN: [number, string][] = [[0, "Sin mínimo"], [30, "30 minutos"], [60, "1 hora"], [120, "2 horas"], [240, "4 horas"], [720, "12 horas"], [1440, "1 día"]];
const ADV: [number, string][] = [[7, "1 semana"], [14, "2 semanas"], [30, "1 mes"], [60, "2 meses"], [90, "3 meses"]];
const STEP: [number, string][] = [[10, "Cada 10 min"], [15, "Cada 15 min"], [20, "Cada 20 min"], [30, "Cada 30 min"], [60, "Cada hora"]];
const CAN: [number, string][] = [[0, "Sin límite"], [60, "1 hora antes"], [120, "2 horas antes"], [240, "4 horas antes"], [720, "12 horas antes"], [1440, "1 día antes"], [2880, "2 días antes"]];

export default function Reglas() {
  const { biz, isManager } = useApp();
  const [s, setS] = useState<S | null>(null); const [err, setErr] = useState(""); const [note, setNote] = useState("");
  useEffect(() => { sb().from("businesses").select("settings").eq("id", biz.id).single().then(({ data }) => setS((data?.settings ?? {}) as S)); }, [biz.id]);

  async function set(k: keyof S, v: number) {
    setErr(""); setNote("");
    const { data, error } = await sb().rpc("set_business_settings", { p_patch: { [k]: v } });
    if (error) return setErr(errEs(error));
    setS(data as S); setNote("Guardado. Ya aplica en tu página de reservas.");
  }
  if (!s) return <main className="card text-sm text-ink/60">Cargando…</main>;
  const Field = ({ k, label, hint, opts, def }: { k: keyof S; label: string; hint: string; opts: [number, string][]; def: number }) => (
    <label className="card block min-w-0 space-y-1.5 p-3">
      <span className="block font-bold">{label}</span><span className="block text-xs text-ink/55">{hint}</span>
      <select className="inp" disabled={!isManager} value={String(s[k] ?? def)} onChange={(e) => set(k, Number(e.target.value))}>
        {!opts.some(([v]) => v === (s[k] ?? def)) && <option value={String(s[k] ?? def)}>{s[k] ?? def} min</option>}
        {opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );
  return (
    <main className="min-w-0 space-y-3">
      <div><div className="eyebrow mb-1">Tu página de reservas</div><h1 className="h1 !mb-0">Reglas de reserva</h1></div>
      <p className="text-sm text-ink/60">Define con cuánta anticipación pueden reservar y cancelar tus clientes.</p>
      {note && <p role="status" className="text-sm text-[#0B5B2B]">{note}</p>}
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <Field k="min_notice_min" label="Anticipación mínima para reservar" hint="Hasta cuánto antes de la cita se puede reservar." opts={MIN} def={60} />
      <Field k="max_advance_days" label="Reservas anticipadas" hint="Hasta cuántos días adelante pueden agendar." opts={ADV} def={30} />
      <Field k="slot_step_min" label="Intervalo de horarios" hint="Cada cuánto se ofrece un horario nuevo." opts={STEP} def={15} />
      <Field k="cancel_notice_min" label="Cancelación del cliente" hint="Con cuánta antelación puede cancelar por su cuenta desde el enlace. Pasado ese margen debe llamarte." opts={CAN} def={0} />
    </main>
  );
}
