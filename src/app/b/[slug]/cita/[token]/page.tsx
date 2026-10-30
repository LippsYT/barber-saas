"use client";
import { use, useEffect, useState } from "react";
import { sb, errEs } from "@/lib/supabase";
import { formatMoney } from "@/lib/money";
export default function Cita({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = use(params);
  const [b, setB] = useState<any>(null); const [msg, setMsg] = useState("");
  const load = () => sb().rpc("public_get_booking", { p_token: token }).then(({ data }) => setB(data ?? false));
  useEffect(() => { load(); }, []);
  async function cancel() { if (!confirm("¿Cancelar tu cita?")) return; const { error } = await sb().rpc("public_cancel_booking", { p_token: token }); setMsg(error ? errEs(error) : "Cita cancelada."); load(); }
  if (b === null) return <main className="p-6">Cargando…</main>;
  if (!b) return <main className="p-6">No encontramos esta cita.</main>;
  const st: Record<string, string> = { reserved: "Reservada", confirmed: "Confirmada", cancelled: "Cancelada", completed: "Atendida", no_show: "No asistió" };
  return (
    <main className="min-h-screen bg-background"><div className="bg-ink px-5 pb-10 pt-12 text-cream"><div className="mx-auto max-w-md"><div className="eyebrow text-gold">Tu cita</div><h1 className="mt-1 font-display text-3xl font-semibold">{b.business_name}</h1></div></div>
      <div className="mx-auto -mt-6 max-w-md space-y-3 px-4">
      <div className="card space-y-2">
        <div className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${b.status === "cancelled" ? "bg-red-100 text-red-800" : "bg-gold/20 text-gold-700"}`}>{st[b.status] ?? b.status}</div>
        <div className="font-display text-xl capitalize">{new Date(b.starts_at).toLocaleString("es-CO", { timeZone: b.timezone, dateStyle: "full", timeStyle: "short" })}</div>
        <div className="text-muted-foreground">Con {b.member_name}</div>
        {b.items.map((i: any) => <div key={i.name} className="flex justify-between text-sm"><span>{i.name}</span><span>{formatMoney(Number(i.price), b.currency)}</span></div>)}
      </div>
      <p className="text-sm text-muted-foreground">Guarda este enlace para ver o cancelar tu cita.</p>
      {["reserved", "confirmed"].includes(b.status) && <button className="btn2 w-full" onClick={cancel}>Cancelar cita</button>}
      <a className="block text-center underline" href={`/b/${slug}`}>Reservar otra cita</a>
      {msg && <p>{msg}</p>}
      </div>
    </main>
  );
}
