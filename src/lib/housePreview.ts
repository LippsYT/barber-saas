import catalog from "@/data/house-davidson.json";
import type { Catalog } from "@/lib/catalog";

type Row = { name: string; description: string; duration_min: number; price_usd: number; type_price: string; category: string; order: number; staff: string[] };

/** Catálogo de muestra con los textos exactos de House Davidson. Solo para la vista previa, no inventa servicios. */
export function houseDavidsonPreview(): Catalog {
  const rows = catalog as Row[];
  const services = rows.map((s, i) => ({
    id: `hd-${i}`,
    name: s.name,
    description: s.description || null,
    category: s.category,
    price_kind: s.type_price === "Fijo" ? "fixed" : "from",
    duration_min: s.duration_min,
    price: Math.round(s.price_usd * 100),
  }));
  const byStaff = new Map<string, { service_id: string; price: number; duration_min: number }[]>();
  rows.forEach((s, i) => {
    for (const name of s.staff) {
      if (!byStaff.has(name)) byStaff.set(name, []);
      byStaff.get(name)!.push({ service_id: `hd-${i}`, price: Math.round(s.price_usd * 100), duration_min: s.duration_min });
    }
  });
  const barbers = [...byStaff.entries()].map(([name, services]) => ({
    id: name, name, slug: name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    weekdays: [1, 2, 3, 4, 5, 6],
    services,
  }));
  return {
    business: {
      name: "House Davidson", slug: "house-davidson", timezone: "America/Guayaquil", currency: "USD",
      address: "avenida reales tamarindo y Joaquín Ramírez, Portoviejo",
      max_advance_days: 90, slot_step_min: 10,
    },
    services, barbers,
  };
}
