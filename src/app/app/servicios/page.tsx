"use client";
import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { formatMoney } from "@/lib/money";
import { type BarberCommissionDraft } from "@/lib/serviceCommission";
import { saveServiceBundle } from "@/lib/saveService";
import { ServiceEditor, emptyServiceDraft, type ServiceDraft } from "@/components/app/ServiceEditor";

export default function Servicios() {
  const { biz } = useApp();
  const [list, setList] = useState<any[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [initial, setInitial] = useState<ServiceDraft | undefined>();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: services }, { data: mem }] = await Promise.all([
      sb().from("services").select("*").eq("business_id", biz.id).order("sort_order").order("name"),
      sb().from("memberships").select("id, display_name").eq("business_id", biz.id).eq("active", true).eq("is_bookable", true).order("display_name"),
    ]);
    setList(services ?? []);
    setMembers((mem ?? []).map((m: { id: string; display_name: string }) => ({ id: m.id, name: m.display_name })));
  };
  useEffect(() => { load(); }, [biz.id]);

  async function openNew() {
    setEditing(null); setInitial(emptyServiceDraft(members)); setOpen(true); setErr("");
  }
  async function openEdit(s: any) {
    const [{ data: rules }, { data: links }] = await Promise.all([
      sb().from("commission_rules").select("member_id, kind, value").eq("business_id", biz.id).eq("item_type", "service").eq("item_id", s.id),
      sb().from("member_services").select("member_id").eq("service_id", s.id),
    ]);
    const linked = new Set((links ?? []).map((l: { member_id: string }) => l.member_id));
    const byMember = new Map((rules ?? []).filter((r: { member_id: string | null }) => r.member_id).map((r: { member_id: string; kind: "percent" | "fixed"; value: number }) => [r.member_id, r]));
    const drafts: BarberCommissionDraft[] = members.map((m) => {
      const rule = byMember.get(m.id);
      return { memberId: m.id, selected: linked.has(m.id), kind: rule?.kind ?? "percent", value: rule ? Number(rule.value) : 50 };
    });
    setEditing(s.id);
    setInitial({ name: s.name, price: (Number(s.price) / 100).toFixed(2), duration: String(s.duration_min), description: s.description ?? "", drafts });
    setOpen(true); setErr("");
  }

  async function save(draft: ServiceDraft) {
    setBusy(true); setErr("");
    const res = await saveServiceBundle(biz.id, editing, draft);
    setBusy(false);
    if ("error" in res) return setErr(res.error);
    setOpen(false); load();
  }

  async function toggle(s: { id: string; active: boolean }) {
    await sb().from("services").update({ active: !s.active }).eq("id", s.id); load();
  }

  if (open && initial) return (
    <main>
      <div className="eyebrow">{editing ? "Editar" : "Nuevo"}</div>
      <h1 className="display mb-4 text-4xl">Servicio</h1>
      <ServiceEditor members={members} currency={biz.currency} initial={initial} submitLabel={editing ? "Guardar" : "Crear"} busy={busy} error={err} onSubmit={save} onCancel={() => setOpen(false)} />
    </main>
  );

  return (
    <main>
      <div className="mb-4 flex items-end justify-between">
        <h1 className="display text-4xl">Servicios</h1>
        <button className="btn" onClick={openNew}>Crear</button>
      </div>
      <ul className="space-y-2">{list.map((s) => (
        <li key={s.id} className="card flex items-center justify-between gap-3">
          <button className="min-w-0 text-left" onClick={() => openEdit(s)}>
            <div className={s.active ? "font-semibold" : "text-ink/40 line-through"}>{s.name}</div>
            <div className="text-sm text-ink/50">{s.duration_min} min · {formatMoney(s.price, biz.currency)}{s.category ? ` · ${s.category}` : ""}</div>
          </button>
          <button className="btn2 shrink-0" onClick={() => toggle(s)}>{s.active ? "Ocultar" : "Activar"}</button>
        </li>
      ))}</ul>
      {!list.length && <p className="text-sm text-ink/50">Crea el primer servicio. En Colaboradores defines la comisión de cada barbero.</p>}
    </main>
  );
}
