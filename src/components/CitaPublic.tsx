"use client";
import { useEffect, useState } from "react";
import { CalendarPlus, MapPin } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { sb, errEs } from "@/lib/supabase";
import { formatMoney } from "@/lib/money";

export interface CitaData {
  status: string;
  starts_at: string;
  member_name: string;
  business_name: string;
  timezone: string;
  currency?: string;
  address?: string | null;
  items: { name: string; price: number }[];
}
export interface CitaLinks { google?: string; wallet?: string | null; apple?: string | null }
export type CitaTone = "reserved" | "cancelled" | "past";

export function citaTone(status: string, startsAt: string, now = Date.now()): CitaTone {
  if (status === "cancelled" || status === "no_show") return "cancelled";
  if (status === "completed" || new Date(startsAt).getTime() <= now) return "past";
  return "reserved";
}

const LABELS: Record<string, string> = {
  reserved: "Reservada", confirmed: "Confirmada", cancelled: "Cancelada", completed: "Pasada", no_show: "No asistió",
};

function whenOf(iso: string, tz: string) {
  const parts = new Intl.DateTimeFormat("es-EC", {
    timeZone: tz, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(new Date(iso));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    weekday: get("weekday"),
    date: `${get("day")} de ${get("month")}`,
    time: `${get("hour")}:${get("minute")} ${get("dayPeriod")}`.replace(/\s+/g, " ").trim(),
  };
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-black/5 py-3 last:border-b-0">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/45">{label}</div>
      <div className="mt-1 text-base font-semibold leading-snug break-words">{value}</div>
    </div>
  );
}

export function CitaPublic({ slug, token, fixture }: { slug: string; token: string; fixture?: CitaData }) {
  const preview = Boolean(fixture);
  const [data, setData] = useState<CitaData | null | false>(fixture ?? null);
  const [links, setLinks] = useState<CitaLinks | null>(preview ? { google: "https://calendar.google.com/calendar/render" } : null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (preview) return;
    let live = true;
    Promise.all([
      sb().rpc("public_get_booking", { p_token: token }),
      sb().rpc("public_booking_calendar", { p_token: token }),
    ]).then(([bk, cal]) => {
      if (!live) return;
      if (!bk.data) { setData(false); return; }
      const address = (cal.data as { address?: string | null } | null)?.address ?? null;
      setData({ ...(bk.data as CitaData), address });
    }).catch(() => { if (live) setData(false); });
    fetch(`/api/cita/${token}/links`).then((r) => r.ok ? r.json() : null).then((j) => { if (live) setLinks(j); }).catch(() => {});
    return () => { live = false; };
  }, [preview, token]);

  async function cancel() {
    if (data === null || data === false) return;
    if (!confirm("¿Cancelar tu cita?")) return;
    if (preview) { setData({ ...data, status: "cancelled" }); setMsg("Cita cancelada."); return; }
    const { error } = await sb().rpc("public_cancel_booking", { p_token: token });
    if (!error) fetch("/api/messages/kick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => {});
    setMsg(error ? errEs(error) : "Cita cancelada.");
    if (!error) setData({ ...data, status: "cancelled" });
  }

  if (data === null) return (
    <main className="grid min-h-[100dvh] place-items-center bg-ink px-6 text-white">
      <div className="pt-[var(--sat)] text-center"><Logo light /><p className="mt-3 text-base text-white/70">Buscando tu cita…</p></div>
    </main>
  );
  if (!data) return (
    <main className="grid min-h-[100dvh] place-items-center bg-ink px-6 text-center text-white">
      <div className="max-w-sm pt-[var(--sat)]">
        <Logo light />
        <h1 className="display mt-4 text-4xl">No encontramos esta cita.</h1>
        <a className="btn-gold mt-6 inline-flex min-h-12 w-full text-base" href="/">Volver al inicio</a>
      </div>
    </main>
  );

  const tone = citaTone(data.status, data.starts_at);
  const when = whenOf(data.starts_at, data.timezone || "America/Guayaquil");
  const services = data.items.map((i) => i.name).filter(Boolean);
  const total = data.items.reduce((a, i) => a + Number(i.price || 0), 0);
  const label = tone === "past" && data.status !== "completed" && data.status !== "no_show" ? "Pasada" : (LABELS[data.status] ?? data.status);
  const pill = tone === "reserved" ? "bg-[#D6FF4A] text-ink" : tone === "cancelled" ? "bg-[#FF4D6A] text-white" : "bg-white/15 text-white";
  const note = tone === "cancelled"
    ? "Esta cita fue cancelada. Puedes reservar otra cuando quieras."
    : tone === "past"
      ? "Esta cita ya pasó. Reserva la próxima."
      : "Guarda este enlace para ver o cancelar tu cita.";
  const upcoming = tone === "reserved";

  return (
    <main className="paper min-h-[100dvh] overflow-x-clip text-ink">
      <header className="bg-ink text-white">
        <div className="mx-auto w-full max-w-lg px-4 pb-5 pt-[calc(0.75rem+var(--sat))]">
          <div className="flex items-center justify-between gap-3">
            <Logo light className="text-[1.35rem]" />
            <span className={`pill shrink-0 ${pill}`}>{label}</span>
          </div>
          <p className="eyebrow mt-5 text-[#D6FF4A]">Tu cita</p>
          <h1 className="display mt-1 break-words text-[2.65rem]">{data.business_name}</h1>
          <p className={`mt-4 font-display text-5xl font-extrabold leading-none tracking-tight ${upcoming ? "" : "line-through decoration-white/40"}`}>{when.time}</p>
          <p className="mt-2 text-base text-white/75">{when.weekday ? when.weekday.charAt(0).toLocaleUpperCase("es") + when.weekday.slice(1) : ""} {when.date}</p>
        </div>
      </header>
      <div className="rise mx-auto w-full max-w-lg px-4 pb-[calc(1.5rem+var(--sab))] pt-4">
        <article className="rounded-[1.7rem] bg-white p-4 shadow-soft">
          <Row label="Barbero" value={data.member_name} />
          <Row label="Servicio" value={services.length ? services.join(" + ") : "Cita"} />
          <Row label="Precio" value={formatMoney(total, data.currency)} />
          {data.address ? (
            <div className="py-3">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/45">Dirección</div>
              <p className="mt-1 flex items-start gap-1.5 text-base font-semibold leading-snug"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#2F5BFF]" /><span className="min-w-0 break-words">{data.address}</span></p>
            </div>
          ) : null}
        </article>
        <p className="mt-3 text-sm leading-relaxed text-ink/60">{note}</p>
        <div className="mt-4 grid gap-2.5">
          {upcoming && (
            <a className="btn2 min-h-12 w-full text-base" href={preview ? "#agregar-calendario" : `/api/cita/${token}/ics`} download={preview ? undefined : "cita.ics"}>
              <CalendarPlus className="h-5 w-5" /> Agregar al calendario
            </a>
          )}
          {upcoming && links?.google && (
            <a className="text-center text-base font-bold text-[#1E3FCC]" href={links.google} target="_blank" rel="noreferrer">También en Google Calendar</a>
          )}
          {upcoming && links?.apple && <a className="btn2 min-h-12 w-full text-base" href={links.apple}>Agregar a Apple Wallet</a>}
          {upcoming && links?.wallet && <a className="btn2 min-h-12 w-full text-base" href={links.wallet} target="_blank" rel="noreferrer">Agregar a Google Wallet</a>}
          {upcoming && <button type="button" className="btn2 min-h-12 w-full text-base text-[#9F1239]" onClick={cancel}>Cancelar cita</button>}
          <a className="btn-gold min-h-12 w-full text-base" href={`/${slug}`}>Reservar otra cita</a>
        </div>
        {msg && <p className="mt-3 text-center text-base" role="status">{msg}</p>}
      </div>
    </main>
  );
}
