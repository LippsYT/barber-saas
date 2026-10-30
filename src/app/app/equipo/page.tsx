"use client";
import { useEffect, useState } from "react";
import { sb, errEs } from "@/lib/supabase";
import { useApp } from "@/components/ctx";
import { formatMoney } from "@/lib/money";

const ROLES = [["barber", "Barbero (comisión)"], ["receptionist", "Recepción (sueldo fijo)"], ["admin", "Admin"]] as const;
const ROLE_ES: Record<string, string> = { owner: "Dueño", admin: "Admin", receptionist: "Recepción", barber: "Barbero" };

export default function Equipo() {
  const { biz, role: myRole } = useApp();
  const [list, setList] = useState<any[]>([]); const [comp, setComp] = useState<Record<string, any>>({});
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [role, setRole] = useState("barber"); const [salary, setSalary] = useState("");
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");
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
    if (role === "receptionist" && salary) await sb().from("member_compensation").update({ pay_type: "fixed", fixed_salary: Number(salary), pay_period: "monthly" }).eq("member_id", data.id);
    setOk(email ? `Listo. ${name} debe crear su cuenta con ${email} en /login y entrará directo.` : `Listo. ${name} ya aparece en la agenda y en el link de reservas.`);
    setName(""); setEmail(""); setSalary(""); load();
  }
  async function deactivate(m: any) { if (confirm(`¿Desactivar a ${m.display_name}?`)) { await sb().from("memberships").update({ active: false }).eq("id", m.id); load(); } }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <main>
      <h1 className="h1">Equipo</h1>
      <div className="card mb-4 text-sm">Link de reservas del negocio:<br /><a className="underline break-all" href={`/b/${biz.slug}`}>{origin}/b/{biz.slug}</a></div>
      <form onSubmit={add} className="card mb-4 space-y-2">
        <div className="font-display text-lg font-semibold">Agregar persona</div>
        <input className="inp" required placeholder="Nombre (ej. Juan)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="inp" type="email" placeholder="Correo para que tenga su usuario (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="inp" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.filter((r) => myRole === "owner" || r[0] !== "admin").map((r) => <option key={r[0]} value={r[0]}>{r[1]}</option>)}</select>
        {role === "receptionist" && <input className="inp" type="number" min={0} placeholder="Sueldo mensual" value={salary} onChange={(e) => setSalary(e.target.value)} />}
        <button className="btn w-full">Agregar</button>
        {err && <p className="text-sm text-red-600">{err}</p>}{ok && <p className="text-sm text-green-700">{ok}</p>}
      </form>
      <ul className="space-y-2">{list.map((m) => (
        <li key={m.id} className="card">
          <div className="flex items-center justify-between">
            <div><div className={m.active ? "font-medium" : "line-through text-gray-400"}>{m.display_name}</div>
              <div className="text-xs text-muted-foreground">{ROLE_ES[m.role]} · {m.user_id ? "con usuario" : m.invited_email ? `invitado: ${m.invited_email}` : "sin usuario"}
                {comp[m.id] && ` · ${comp[m.id].pay_type === "commission" ? "comisión" : comp[m.id].pay_type === "fixed" ? "sueldo " + formatMoney(comp[m.id].fixed_salary, biz.currency) : "mixto"}`}</div></div>
            {m.role !== "owner" && m.active && <button className="btn2" onClick={() => deactivate(m)}>Desactivar</button>}
          </div>
          {m.booking_slug && <a className="text-xs underline break-all" href={`/b/${biz.slug}/${m.booking_slug}`}>{origin}/b/{biz.slug}/{m.booking_slug}</a>}
        </li>))}
      </ul>
    </main>
  );
}
