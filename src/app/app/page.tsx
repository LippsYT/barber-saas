"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { sb } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { addDays, localDate, localTime, localToUtcMs } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { HomeDash, type HomeFigure, type HomeVisit } from "@/components/app/HomeDash";
import { Checklist } from "@/components/app/Checklist";

function monthBounds(today: string) {
  const start = today.slice(0, 8) + "01";
  const [y, m] = today.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const prev = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
  return { start, next, prev };
}

export default function Inicio() {
  const { biz, role } = useApp();
  const [ready, setReady] = useState(false);
  const [salesCents, setSales] = useState(0);
  const [delta, setDelta] = useState<number | null>(null);
  const [figures, setFigures] = useState<HomeFigure[]>([]);
  const [visits, setVisits] = useState<HomeVisit[]>([]);
  const [links, setLinks] = useState<{ href: string; label: string }[]>([]);

  useEffect(() => { (async () => {
    const today = localDate(Date.now(), biz.timezone);
    const { start, next, prev } = monthBounds(today);
    const fromPrev = new Date(localToUtcMs(prev, "00:00", biz.timezone)).toISOString();
    const from = new Date(localToUtcMs(start, "00:00", biz.timezone)).toISOString();
    const to = new Date(localToUtcMs(next, "00:00", biz.timezone)).toISOString();
    const [{ data: sales }, { data: appts }, { count: newClients }] = await Promise.all([
      sb().from("sales").select("total, created_at").eq("business_id", biz.id).eq("status", "paid").gte("created_at", fromPrev).lt("created_at", to),
      sb().from("appointments").select("id, starts_at, status, client:clients(full_name), member:memberships(display_name), items:appointment_items(name)").eq("business_id", biz.id).gte("starts_at", from).lt("starts_at", to).order("starts_at", { ascending: false }).limit(40),
      sb().from("clients").select("id", { count: "exact", head: true }).eq("business_id", biz.id).gte("created_at", from).lt("created_at", to),
    ]);
    const rows = sales ?? [];
    const cur = rows.filter((s) => s.created_at >= from).reduce((a, s) => a + Number(s.total), 0);
    const old = rows.filter((s) => s.created_at < from).reduce((a, s) => a + Number(s.total), 0);
    const nSales = rows.filter((s) => s.created_at >= from).length;
    const live = (appts ?? []).filter((a) => !["cancelled", "no_show"].includes(a.status));
    setSales(cur);
    setDelta(old > 0 ? Math.round(((cur - old) / old) * 1000) / 10 : null);
    setFigures([
      { label: "Citas del mes", value: String(live.length) },
      { label: "Ticket promedio", value: nSales ? formatMoney(Math.round(cur / nSales)) : "US$ 0.00" },
      { label: "Ventas cobradas", value: String(nSales) },
      { label: "Clientes nuevos", value: String(newClients ?? 0) },
    ]);
    setVisits(live.slice(0, 5).map((a) => ({
      id: a.id,
      time: localTime(Date.parse(a.starts_at), biz.timezone),
      title: (a.items as { name: string }[])?.map((i) => i.name).join(", ") || "Cita",
      who: `${(a.client as { full_name?: string } | null)?.full_name ?? "Sin cliente"} · ${(a.member as { display_name?: string } | null)?.display_name ?? ""}`,
    })));
    const extra = role === "owner" || role === "admin"
      ? [{ href: "/app/servicios", label: "Servicios" }, { href: "/app/equipo", label: "Equipo" }, { href: "/app/libro", label: "Libro" }, { href: "/app/whatsapp", label: "WhatsApp" }, { href: "/app/pulselink", label: "Pulse Link" }, { href: `/${biz.slug}`, label: "Link de reservas" }]
      : [{ href: "/app/cobro", label: "Cobrar" }];
    setLinks(extra);
    setReady(true);
  })(); }, [biz.id, biz.timezone, biz.slug, role]);

  const today = localDate(Date.now(), biz.timezone);
  const { next } = monthBounds(today);
  const daysLeft = Math.max(0, Math.round((Date.parse(addDays(next, -1) + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000));
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: biz.timezone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const monthLabel = new Date(today.slice(0, 8) + "01T12:00:00").toLocaleDateString("es-CO", { month: "long" });

  if (!ready) return <p className="text-sm text-ink/50">Cargando tus cifras…</p>;
  return (
    <>
      {(role === "owner" || role === "admin") && <div className="mb-4"><Checklist bizId={biz.id} slug={biz.slug} name={biz.name} /></div>}
      <HomeDash greeting={greeting} business={biz.name} monthLabel={monthLabel} salesCents={salesCents} daysLeft={daysLeft} delta={delta} figures={figures} visits={visits} />
      <div className="mt-4 flex flex-wrap gap-2">{links.map((l) => <Link key={l.href} href={l.href} className="pill bg-white shadow-sm">{l.label}</Link>)}</div>
    </>
  );
}
