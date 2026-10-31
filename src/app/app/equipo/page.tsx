"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Copy, ExternalLink, Plus, X } from "lucide-react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { Avatar } from "@/components/ui/avatar";
import { formatMoney, toCents } from "@/lib/money";
import { appBaseUrl } from "@/lib/messaging/templates";

const ROLES = [["barber", "Barbero (comisión)"], ["receptionist", "Recepción (sueldo fijo)"], ["admin", "Admin"]] as const;
const ROLE_ES: Record<string, string> = { owner: "Dueño", admin: "Admin", receptionist: "Recepción", barber: "Barbero" };
const ROLE_TONE: Record<string, string> = { owner: "bg-ink text-white", admin: "bg-[#2F5BFF] text-white", receptionist: "bg-[#9AD7FF] text-ink", barber: "bg-[#D6FF4A] text-ink" };

/** Achica la foto a 640 px (JPEG) antes de subirla: las del celular pesan varios MB. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo leer la foto."))), "image/jpeg", 0.85));
}

function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-ink/[0.04] p-2 pl-3">
      <span className="min-w-0 flex-1 truncate text-xs text-ink/70">{url.replace(/^https?:\/\//, "")}</span>
      <button type="button" aria-label="Copiar link" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white shadow-sm active:scale-95"
        onClick={async () => { try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* sin permiso de portapapeles */ } }}>
        {done ? <Check className="h-4 w-4 text-[#14944A]" /> : <Copy className="h-4 w-4" />}
      </button>
      <a aria-label="Abrir link" href={url} target="_blank" rel="noreferrer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white shadow-sm active:scale-95"><ExternalLink className="h-4 w-4" /></a>
    </div>
  );
}

export default function Equipo() {
  const { biz, role: myRole } = useApp();
  const canEdit = myRole === "owner" || myRole === "admin";
  const [list, setList] = useState<any[]>([]); const [comp, setComp] = useState<Record<string, any>>({});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [role, setRole] = useState("barber"); const [salary, setSalary] = useState("");
  const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busyId, setBusyId] = useState("");
  const pick = useRef<HTMLInputElement>(null); const pickFor = useRef("");
  const base = appBaseUrl();
  const load = async () => {
    const { data } = await sb().from("memberships").select("*").eq("business_id", biz.id).order("created_at"); setList(data ?? []);
    const { data: c } = await sb().from("member_compensation").select("*").eq("business_id", biz.id);
    setComp(Object.fromEntries((c ?? []).map((x: any) => [x.member_id, x])));
  };
  useEffect(() => { load(); }, []);
  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setOk("");
    const { data, error } = await sb().from("memberships").insert({ business_id: biz.id, display_name: name.trim(), invited_email: email.trim().toLowerCase() || null, role, is_bookable: role === "barber" }).select().single();
    if (error) return setErr(errEs(error));
    if (role === "receptionist" && salary) await sb().from("member_compensation").update({ pay_type: "fixed", fixed_salary: toCents(salary), pay_period: "monthly" }).eq("member_id", data.id);
    setOk(email ? `Listo. ${name} debe crear su cuenta con ${email} en /login y entrará directo.` : `Listo. ${name} ya aparece en la agenda y en el link de reservas. Toca su foto para ponerle una.`);
    setName(""); setEmail(""); setSalary(""); setOpen(false); load();
  }
  async function deactivate(m: any) { if (confirm(`¿Desactivar a ${m.display_name}?`)) { await sb().from("memberships").update({ active: false }).eq("id", m.id); load(); } }
  async function upload(file: File, m: any) {
    setErr(""); setBusyId(m.id);
    try {
      const blob = await shrink(file);
      const path = `${biz.id}/${m.id}-${Date.now()}.jpg`;
      const { error } = await sb().storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error("No se pudo subir la foto. Revisa que exista el bucket avatars en Supabase (migración 0022).");
      const { data } = sb().storage.from("avatars").getPublicUrl(path);
      const { error: e2 } = await sb().from("memberships").update({ avatar_url: data.publicUrl }).eq("id", m.id);
      if (e2) throw new Error(errEs(e2));
      load();
    } catch (e) { setErr((e as Error).message); } finally { setBusyId(""); }
  }
  const active = list.filter((m) => m.active), inactive = list.filter((m) => !m.active);
  return (
    <main className="min-w-0">
      <div className="mb-1 eyebrow">Tu gente</div>
      <h1 className="h1">Equipo</h1>
      <input ref={pick} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; const m = list.find((x) => x.id === pickFor.current); e.target.value = ""; if (f && m) upload(f, m); }} />

      <section className="card mb-4 space-y-2">
        <div className="font-display text-xl font-extrabold uppercase leading-none">Link de reservas del negocio</div>
        <p className="text-sm text-ink/60">Compártelo con tus clientes. Elegirán barbero, servicio y hora.</p>
        <CopyLink url={`${base}/${biz.slug}`} />
      </section>

      {canEdit && (open ? (
        <form onSubmit={add} className="card mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-display text-xl font-extrabold uppercase leading-none">Agregar persona</div>
            <button type="button" aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full bg-ink/5" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
          </div>
          <label className="block"><span className="lbl">Nombre</span><input className="inp" required placeholder="Ej. Juan" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="block"><span className="lbl">Cargo</span>
            <select className="inp" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.filter((r) => myRole === "owner" || r[0] !== "admin").map((r) => <option key={r[0]} value={r[0]}>{r[1]}</option>)}</select></label>
          {role === "receptionist" && <label className="block"><span className="lbl">Sueldo mensual (US$)</span><input className="inp" type="number" inputMode="decimal" min={0} step="0.01" value={salary} onChange={(e) => setSalary(e.target.value)} /></label>}
          <label className="block"><span className="lbl">Correo (opcional)</span><input className="inp" type="email" placeholder="Para que tenga su propio usuario" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="btn w-full">Agregar al equipo</button>
          {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        </form>
      ) : (
        <button className="btn mb-4 w-full" onClick={() => { setOpen(true); setOk(""); }}><Plus className="h-4 w-4" /> Agregar persona</button>
      ))}
      {!open && err && <p role="alert" className="mb-3 rounded-2xl bg-[#FFE1E7] p-3 text-sm text-[#7A0F24]">{err}</p>}
      {ok && <p role="status" className="mb-3 rounded-2xl bg-[#E3F8EA] p-3 text-sm text-[#0B5B2B]">{ok}</p>}

      <ul className="space-y-3">{active.map((m) => (
        <li key={m.id} className="card min-w-0 space-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" disabled={!canEdit || busyId === m.id} aria-label={`Cambiar foto de ${m.display_name}`} className="relative shrink-0 disabled:opacity-60" onClick={() => { pickFor.current = m.id; pick.current?.click(); }}>
              <Avatar name={m.display_name} src={m.avatar_url} size={64} />
              {canEdit && <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-[#D6FF4A] text-ink shadow"><Camera className="h-3.5 w-3.5" /></span>}
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-2xl font-extrabold uppercase leading-none">{m.display_name}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className={`pill ${ROLE_TONE[m.role] ?? "bg-white"}`}>{ROLE_ES[m.role]}</span>
                <span className="text-xs text-ink/55">{busyId === m.id ? "Subiendo foto…" : m.user_id ? "Con usuario" : m.invited_email ? `Invitado: ${m.invited_email}` : "Sin usuario"}</span>
              </div>
            </div>
          </div>
          {comp[m.id] && <div className="text-sm text-ink/70">{comp[m.id].pay_type === "commission" ? "Gana por comisión" : comp[m.id].pay_type === "fixed" ? `Sueldo ${formatMoney(comp[m.id].fixed_salary, biz.currency)} al mes` : "Sueldo mixto"}</div>}
          {m.booking_slug && <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink/45">Su link de reservas</div><CopyLink url={`${base}/${biz.slug}/${m.booking_slug}`} /></div>}
          {canEdit && m.role !== "owner" && <button className="btn2 w-full text-red-700" onClick={() => deactivate(m)}>Desactivar</button>}
        </li>))}
      </ul>
      {inactive.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-ink/55">Desactivados ({inactive.length})</summary>
        <ul className="mt-2 space-y-2">{inactive.map((m) => <li key={m.id} className="card flex items-center gap-3 py-2 opacity-60"><Avatar name={m.display_name} src={m.avatar_url} size={40} /><span className="line-through">{m.display_name}</span></li>)}</ul></details>}
    </main>
  );
}
