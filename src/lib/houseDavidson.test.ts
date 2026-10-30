import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import catalog from "../data/house-davidson.json";

type Svc = {
  name: string;
  description: string;
  duration_min: number;
  price_usd: number;
  type_price: string;
  category: string;
  order: number;
  staff: string[];
};

const services = catalog as Svc[];

function sqlStringAt(src: string, i: number): [string, number] {
  if (src[i] !== "'") throw new Error("expected quote at " + i);
  let out = "";
  i++;
  while (i < src.length) {
    if (src[i] === "'" && src[i + 1] === "'") { out += "'"; i += 2; continue; }
    if (src[i] === "'") return [out, i + 1];
    out += src[i++];
  }
  throw new Error("unterminated string");
}

function skipSpace(src: string, i: number) {
  while (src[i] === " " || src[i] === "\n") i++;
  return i;
}

describe("seed House Davidson", () => {
  const sql = fs.readFileSync(path.resolve(import.meta.dirname, "../../supabase/migrations/0009_seed_house_davidson.sql"), "utf8");
  const fix = fs.readFileSync(path.resolve(import.meta.dirname, "../../supabase/migrations/0010_catalog_cover_whatsapp.sql"), "utf8");

  function seededServices() {
    const marker = "insert into services(business_id, name, description, duration_min, price, sort_order) values (bid, ";
    const out: { name: string; description: string | null; duration_min: number; price: number; sort_order: number }[] = [];
    let i = 0;
    while (true) {
      const at = sql.indexOf(marker, i);
      if (at < 0) break;
      let p = at + marker.length;
      const [name, a] = sqlStringAt(sql, p);
      p = skipSpace(sql, a);
      if (sql[p] !== ",") throw new Error("comma");
      p = skipSpace(sql, p + 1);
      let description: string | null;
      if (sql.startsWith("null", p)) { description = null; p += 4; }
      else { const [d, n] = sqlStringAt(sql, p); description = d; p = n; }
      p = skipSpace(sql, p);
      if (sql[p] !== ",") throw new Error("comma2");
      p = skipSpace(sql, p + 1);
      const m = /^(\d+),\s*(\d+),\s*(\d+)/.exec(sql.slice(p));
      if (!m) throw new Error("nums " + sql.slice(p, p + 30));
      out.push({ name, description, duration_min: Number(m[1]), price: Number(m[2]), sort_order: Number(m[3]) });
      i = p + m[0].length;
    }
    return out;
  }

  it("son 20 servicios, textos y precios exactos de la fuente", () => {
    expect(services).toHaveLength(20);
    const rows = seededServices();
    expect(rows).toHaveLength(20);
    services.forEach((s, idx) => {
      const row = rows[idx];
      expect(row.name).toBe(s.name);
      expect(row.description).toBe(s.description === "" ? null : s.description);
      expect(row.duration_min).toBe(s.duration_min);
      expect(row.price).toBe(Math.round(s.price_usd * 100));
      expect(row.sort_order).toBe(s.order);
    });
  });

  it("cada profesional ofrece exactamente los servicios de la fuente", () => {
    const staff = new Map<string, Set<string>>();
    for (const s of services) for (const name of s.staff) {
      if (!staff.has(name)) staff.set(name, new Set());
      staff.get(name)!.add(s.name);
    }
    for (const [name, set] of staff) {
      const marker = `values (bid, '${name}',`;
      const at = sql.indexOf(marker);
      expect(at, name).toBeGreaterThan(-1);
      const inn = sql.indexOf("name in (", at);
      const end = sql.indexOf("));", inn);
      const list = sql.slice(inn, end);
      const found = new Set<string>();
      let p = 0;
      while (true) {
        const q = list.indexOf("'", p);
        if (q < 0) break;
        const [str, n] = sqlStringAt(list, q);
        if (str !== "name in (") found.add(str);
        p = n;
      }
      expect([...found].sort()).toEqual([...set].sort());
    }
  });

  it("horario lun–sáb 09:00–20:00, bloques de 10 min, sin teléfono inventado", () => {
    expect(sql).toContain("'09:00', '20:00'");
    expect(sql).toContain("generate_series(1, 6)");
    expect(sql).toContain('"slot_step_min":10');
    expect(sql).not.toContain("0968467113");
    expect(sql).toContain("avenida reales tamarindo y Joaquín Ramírez, Portoviejo");
  });

  it("0010 guarda categoría y tipo de precio exactos", () => {
    for (const s of services) {
      const kind = s.type_price === "Fijo" ? "fixed" : "from";
      const needle = `('${s.name.replace(/'/g, "''")}','${s.category}','${kind}')`;
      expect(fix).toContain(needle);
    }
  });
});
