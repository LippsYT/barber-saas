/** Cuánto se le debe a cada persona del equipo por un día: comisión + propinas − adelantos. Todo en centavos. */
export interface TeamBarber { id: string; name: string; services: number; income: number; tips: number }
export interface TeamCommission { member_id: string; item_type: string; amount: number }
export interface TeamAdvance { member_id: string; amount: number }
/** Una línea vendida: quién la hizo, qué fue y cuántas veces. */
export interface TeamItem { member_id: string; name: string; qty: number }
export interface TeamRow {
  id: string; name: string;
  /** Qué hizo: «3 × Servicio premium, 2 × Servicio básico». Más hecho primero. */
  items: { name: string; qty: number }[];
  /** Servicios atendidos y lo que facturó. */
  services: number; income: number;
  /** Comisión por servicios y productos. */
  commission: number;
  /** Propinas que dejaron los clientes: son de la persona, no de la barbería. */
  tips: number;
  /** Adelantos dados ese día: se restan de lo que se le debe. */
  advances: number;
  /** Lo que la barbería le debe: comisión + propinas − adelantos. Negativo = ya recibió de más. */
  owed: number;
}

export function teamOfDay(barbers: TeamBarber[], commissions: TeamCommission[], advances: TeamAdvance[], names: Record<string, string> = {}, sold: TeamItem[] = []): TeamRow[] {
  const ids = new Set<string>([...barbers.map((b) => b.id), ...commissions.map((c) => c.member_id), ...advances.map((a) => a.member_id), ...sold.map((s) => s.member_id)]);
  const rows: TeamRow[] = [];
  for (const id of ids) {
    const b = barbers.find((x) => x.id === id);
    const mine = commissions.filter((c) => c.member_id === id);
    const commission = mine.filter((c) => c.item_type !== "tip").reduce((s, c) => s + c.amount, 0);
    const tipShare = mine.filter((c) => c.item_type === "tip").reduce((s, c) => s + c.amount, 0);
    const tips = tipShare || (b?.tips ?? 0);
    const adv = advances.filter((a) => a.member_id === id).reduce((s, a) => s + a.amount, 0);
    const byName = new Map<string, number>();
    for (const s of sold) if (s.member_id === id) byName.set(s.name, (byName.get(s.name) ?? 0) + s.qty);
    const items = [...byName].map(([name, qty]) => ({ name, qty })).sort((x, y) => y.qty - x.qty || x.name.localeCompare(y.name, "es"));
    rows.push({ id, name: b?.name ?? names[id] ?? "—", items, services: b?.services ?? 0, income: b?.income ?? 0, commission, tips, advances: adv, owed: commission + tips - adv });
  }
  return rows.sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name, "es"));
}
