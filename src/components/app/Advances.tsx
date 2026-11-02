"use client";
import { useCallback, useEffect, useState } from "react";
import { sb, errEs } from "@/lib/supabase";
import { formatMoney, toCents } from "@/lib/money";

type Status = "pending" | "approved" | "rejected" | "cancelled";
type Req = { id: string; amount: number | string; note: string | null; status: Status; requested_at: string };
type PendingReq = Req & { member: { display_name: string } | null };

const STATUS_ES: Record<Status, string> = { pending: "Pendiente", approved: "Aprobado", rejected: "Rechazado", cancelled: "Cancelado" };
const TONE: Record<Status, string> = { pending: "bg-[#FFF4CC] text-[#6B4A00]", approved: "bg-[#E3F8EA] text-[#0B5B2B]", rejected: "bg-[#FFE1E7] text-[#7A0F24]", cancelled: "bg-ink/10 text-ink/60" };
const day = (iso: string) => new Date(iso).toLocaleDateString("es-EC", { day: "numeric", month: "short" });

/** Lo que ve quien pide: el formulario y el estado de sus solicitudes. */
export function MyAdvances({ memberId, currency }: { memberId: string; currency: string }) {
  const [list, setList] = useState<Req[]>([]);
  const [amount, setAmount] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const load = useCallback(async () => {
    const { data } = await sb().from("advance_requests").select("id, amount, note, status, requested_at").eq("member_id", memberId).order("requested_at", { ascending: false }).limit(8);
    setList((data ?? []) as Req[]);
  }, [memberId]);
  useEffect(() => { void load(); }, [load]);
  const pending = list.some((r) => r.status === "pending");

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setOk("");
    const cents = toCents(amount);
    if (!(cents > 0)) return setErr("Escribe cuánto necesitas.");
    setBusy(true);
    const { error } = await sb().rpc("request_advance", { p_amount: cents, p_note: note.trim() || null });
    setBusy(false);
    if (error) return setErr(errEs(error));
    setAmount(""); setNote(""); setOk("Listo. El dueño verá tu solicitud y te responderá."); void load();
  }
  async function cancel(id: string) {
    setErr(""); setOk("");
    const { error } = await sb().rpc("cancel_advance_request", { p_request: id });
    if (error) return setErr(errEs(error));
    void load();
  }

  return (
    <section className="card mb-3 space-y-3" aria-label="Adelantos">
      <div className="font-display text-xl font-extrabold uppercase leading-none">Pedir un adelanto</div>
      {pending ? <p className="text-sm text-ink/65">Ya tienes una solicitud pendiente. Cuando el dueño la responda podrás pedir otra.</p> : (
        <form onSubmit={submit} className="space-y-2">
          <label className="block"><span className="lbl">¿Cuánto necesitas? (US$)</span><input className="inp" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))} /></label>
          <label className="block"><span className="lbl">Para qué (opcional)</span><input className="inp" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <button className="btn w-full" disabled={busy}>{busy ? "Enviando…" : "Pedir adelanto"}</button>
          <p className="text-xs text-ink/55">El dueño lo aprueba o lo rechaza. Si lo aprueba, se descuenta de lo que se te debe.</p>
        </form>
      )}
      {err && <p role="alert" className="rounded-2xl bg-[#FFE1E7] p-3 text-sm text-[#7A0F24]">{err}</p>}
      {ok && <p role="status" className="rounded-2xl bg-[#E3F8EA] p-3 text-sm text-[#0B5B2B]">{ok}</p>}
      {list.length > 0 && <ul className="divide-y divide-black/5">{list.map((r) => (
        <li key={r.id} className="flex items-center gap-3 py-2">
          <div className="min-w-0 flex-1"><div className="font-bold">{formatMoney(Number(r.amount), currency)}</div><div className="truncate text-xs text-ink/55">{day(r.requested_at)}{r.note ? ` · ${r.note}` : ""}</div></div>
          <span className={`pill ${TONE[r.status]}`}>{STATUS_ES[r.status]}</span>
          {r.status === "pending" && <button className="text-sm font-semibold text-red-700 underline" onClick={() => cancel(r.id)}>Cancelar</button>}
        </li>))}</ul>}
    </section>
  );
}

/** Lo que ve el dueño o admin: solicitudes pendientes para aprobar o rechazar. No pinta nada si no hay. */
export function AdvanceApprovals({ bizId, currency, onDone }: { bizId: string; currency: string; onDone?: () => void }) {
  const [list, setList] = useState<PendingReq[]>([]);
  const [method, setMethod] = useState<Record<string, "cash" | "transfer">>({});
  const [busyId, setBusyId] = useState(""); const [err, setErr] = useState("");
  const load = useCallback(async () => {
    const { data } = await sb().from("advance_requests").select("id, amount, note, status, requested_at, member:memberships(display_name)").eq("business_id", bizId).eq("status", "pending").order("requested_at");
    setList((data ?? []) as unknown as PendingReq[]);
  }, [bizId]);
  useEffect(() => { void load(); }, [load]);

  async function decide(id: string, approve: boolean) {
    setErr(""); setBusyId(id);
    const { error } = await sb().rpc("decide_advance_request", { p_request: id, p_approve: approve, p_method: method[id] ?? "cash", p_note: null });
    setBusyId("");
    if (error) return setErr(errEs(error));
    await load(); onDone?.();
  }
  if (!list.length && !err) return null;
  return (
    <section className="card mb-3 space-y-3 border-2 border-[#D6FF4A]" aria-label="Adelantos por aprobar">
      <div className="font-display text-xl font-extrabold uppercase leading-none">Adelantos por aprobar ({list.length})</div>
      {err && <p role="alert" className="rounded-2xl bg-[#FFE1E7] p-3 text-sm text-[#7A0F24]">{err}</p>}
      <ul className="space-y-3">{list.map((r) => (
        <li key={r.id} className="space-y-2 rounded-2xl bg-ink/[0.04] p-3">
          <div className="flex items-baseline justify-between gap-2"><span className="font-bold">{r.member?.display_name ?? "Persona"}</span><span className="font-display text-2xl font-extrabold">{formatMoney(Number(r.amount), currency)}</span></div>
          <div className="text-xs text-ink/55">{day(r.requested_at)}{r.note ? ` · ${r.note}` : ""}</div>
          <div className="flex items-center gap-2">
            <select aria-label="Cómo se le entrega" className="inp !w-auto !py-2 text-sm" value={method[r.id] ?? "cash"} onChange={(e) => setMethod({ ...method, [r.id]: e.target.value as "cash" | "transfer" })}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></select>
            <button className="btn2 flex-1 !py-2 text-red-700" disabled={busyId === r.id} onClick={() => decide(r.id, false)}>Rechazar</button>
            <button className="btn flex-1 !py-2" disabled={busyId === r.id} onClick={() => decide(r.id, true)}>{busyId === r.id ? "…" : "Aprobar"}</button>
          </div>
        </li>))}</ul>
    </section>
  );
}
