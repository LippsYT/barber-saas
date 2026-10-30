"use client";
import { use, useEffect, useState } from "react";
import { sb, errEs } from "@/lib/supabase";
import { formatMoney } from "@/lib/money";
import { Scissors } from "lucide-react";

export default function Cita({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = use(params);
  const [b, setB] = useState<any>(null); const [msg, setMsg] = useState("");
  const load = () => sb().rpc("public_get_booking", { p_token: token }).then(({ data }) => setB(data ?? false));
  useEffect(() => { load(); }, []);
  async function cancel() { if (!confirm("¿Cancelar tu cita?")) return; const { error } = await sb().rpc("public_cancel_booking", { p_token: token }); setMsg(error ? errEs(error) : "Cita cancelada."); load(); }
  if (b === null) return <main className="grid min-h-screen place-items-center bg-ink text-cream"><div className="flex flex-col items-center gap-3"><Scissors className="h-7 w-7 animate-pulse text-gold" /><p className="font-display">Buscando tu cita…</p></div></main>;
  if (!b) return <main className="grid min-h-screen place-items-center bg-ink p-6 text-center text-cream"><p className="font-display text-2xl">No encontramos esta cita.</p></main>;
  const st: Record<string, string> = { reserved: "Reservada", confirmed: "Confirmada", cancelled: "Cancelada", completed: "Atendida", no_show: "No asistió" };
  return (
    <main className="min-h-screen bg-background">
      <div className="grain relative overflow-hidden bg-ink px-5 pb-16 pt-14 text-cream">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(201,163,92,.28),transparent_45%)]" />
        <div className="relative mx-auto max-w-md">
          <div className="eyebrow text-gold">Tu cita</div>
          <h1 className="mt-1 font-display text-4xl font-semibold">{b.business_name}</h1>
        </div>
      </div>
      <div className="mx-auto -mt-8 max-w-md space-y-3 px-4 pb-16">
        <div className="card space-y-3 shadow-lg">
          <div className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${b.status === "cancelled" ? "bg-red-100 text-red-800" : "bg-gold/20 text-gold-700"}`}>{st[b.status] ?? b.status}</div>
          <div className="font-display text-2xl capitalize leading-tight">{new Date(b.starts_at).toLocaleString("es-CO", { timeZone: b.timezone, dateStyle: "full", timeStyle: "short" })}</div>
          <div className="text-muted-foreground">Con {b.member_name}</div>
          <div className="border-t border-dashed border-gold/40 pt-3">
            {b.items.map((i: any) => <div key={i.name} className="flex justify-between py-1 text-sm"><span>{i.name}</span><span className="font-medium tabular-nums">{formatMoney(Number(i.price), b.currency)}</span></div>)}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Guarda este enlace para ver o cancelar tu cita.</p>
        {["reserved", "confirmed"].includes(b.status) && <button className="btn2 w-full" onClick={cancel}>Cancelar cita</button>}
        <a className="btn-gold w-full" href={`/b/${slug}`}>Reservar otra cita</a>
        {msg && <p className="text-center text-sm">{msg}</p>}
      </div>
    </main>
  );
}
