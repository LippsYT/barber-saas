import { describe, it, expect, beforeAll } from "vitest";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario } from "./harness";

let db: Db; let s: Scenario;
beforeAll(async () => { db = await createDb(); s = await seedScenario(db); });

type Cat = { business: { name: string; logo_url: string | null }; services: unknown[]; barbers: unknown[] } | null;
const catalog = (slug: string) => asUser(db, null, async () => (await rows<{ c: Cat }>(db, "select public_get_catalog($1) c", [slug]))[0].c);

describe("Logotipo del negocio", () => {
  it("sin logo el catálogo devuelve logo_url nulo y el resto igual", async () => {
    const c = await catalog("barberia-test");
    expect(c?.business.name).toBe("Barbería Test");
    expect(c?.business.logo_url).toBeNull();
    expect(Array.isArray(c?.barbers)).toBe(true);
  });
  it("el dueño guarda el logo y cualquiera lo ve en el catálogo público", async () => {
    await asUser(db, s.owner, () => rows(db, "update businesses set logo_url = 'https://x.supabase.co/storage/v1/object/public/covers/b/logo.png' where id = $1", [s.bid]));
    expect((await catalog("barberia-test"))?.business.logo_url).toBe("https://x.supabase.co/storage/v1/object/public/covers/b/logo.png");
  });
  it("un extraño no puede cambiar el logo de otro negocio", async () => {
    await asUser(db, s.stranger, () => rows(db, "update businesses set logo_url = 'https://evil.example/x.png' where id = $1", [s.bid]));
    expect((await catalog("barberia-test"))?.business.logo_url).toContain("supabase.co");
  });
  it("un enlace que no existe sigue devolviendo nulo", async () => {
    expect(await catalog("no-existe")).toBeNull();
  });
  it("la función base no se puede llamar desde fuera", async () => {
    await expect(asUser(db, null, () => rows(db, "select _public_get_catalog_base('barberia-test')"))).rejects.toThrow();
  });
});
