import { describe, it, expect, beforeAll } from "vitest";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario } from "./harness";

let db: Db; let s: Scenario;
const SECRET = "s".repeat(64);
beforeAll(async () => { db = await createDb(); s = await seedScenario(db); });

describe("galería y enlace", () => {
  it("el catálogo público trae la galería en orden", async () => {
    await asUser(db, s.owner, async () => {
      await rows(db, "insert into portfolio_images(business_id, url, sort_order) values ($1,'https://img.test/2.jpg',2),($1,'https://img.test/1.jpg',1)", [s.bid]);
    });
    const [r] = await asUser(db, null, () => rows<{ c: { business: { gallery: string[] } } }>(db, "select public_get_catalog('barberia-test') c"));
    expect(r.c.business.gallery).toEqual(["https://img.test/1.jpg", "https://img.test/2.jpg"]);
    await expect(asUser(db, s.barberA, () => rows(db, "insert into portfolio_images(business_id, url) values ($1,'https://x.co/a.jpg')", [s.bid]))).rejects.toThrow();
    await expect(asUser(db, s.owner, () => rows(db, "insert into portfolio_images(business_id, url) values ($1,'http://x.co/a.jpg')", [s.bid]))).rejects.toThrow();
  });
  it("solo el dueño cambia el enlace; los reservados y repetidos se rechazan", async () => {
    await expect(asUser(db, s.admin, () => rows(db, "select change_business_slug('nuevo-nombre')"))).rejects.toThrow();
    await expect(asUser(db, s.owner, () => rows(db, "select change_business_slug('app')"))).rejects.toThrow(/slug_taken/);
    await expect(asUser(db, s.owner, () => rows(db, "select change_business_slug('Mal Enlace!')"))).rejects.toThrow(/invalid_slug/);
    const [r] = await asUser(db, s.owner, () => rows<{ s: string }>(db, "select change_business_slug('Casa-Nueva') s"));
    expect(r.s).toBe("casa-nueva");
    const other = (await rows<{ id: string }>(db, "insert into businesses(name, slug) values ('Otra','otra-barberia') returning id"))[0].id;
    expect(other).toBeTruthy();
    await expect(asUser(db, s.owner, () => rows(db, "select change_business_slug('otra-barberia')"))).rejects.toThrow(/slug_taken/);
  });
});

describe("inventario", () => {
  it("dueño/admin gestionan productos; el barbero solo los ve; proveedores no los ve", async () => {
    const [p] = await asUser(db, s.owner, () => rows<{ id: string }>(db, "insert into products(business_id, name, price, cost, stock) values ($1,'Cera',1500,800,10) returning id", [s.bid]));
    await asUser(db, s.owner, () => rows(db, "insert into suppliers(business_id, name) values ($1,'Distribuidora')", [s.bid]));
    expect(await asUser(db, s.barberA, () => rows(db, "select * from products where id=$1", [p.id]))).toHaveLength(1);
    await expect(asUser(db, s.barberA, () => rows(db, "update products set stock=0 where id=$1", [p.id]))).resolves.toEqual([]);
    expect((await rows<{ stock: number }>(db, "select stock from products where id=$1", [p.id]))[0].stock).toBe(10);
    expect(await asUser(db, s.barberA, () => rows(db, "select * from suppliers"))).toHaveLength(0);
    await expect(asUser(db, s.owner, () => rows(db, "insert into products(business_id, name, stock) values ($1,'Malo',-1)", [s.bid]))).rejects.toThrow();
  });
});

describe("informe semanal", () => {
  it("solo con el secreto; trae ventas, gastos y citas del periodo", async () => {
    await expect(asUser(db, null, () => rows(db, "select * from report_targets('x')"))).rejects.toThrow();
    await asUser(db, s.owner, () => rows(db, "select set_business_settings('{\"weekly_report\":true}')"));
    const t = await asUser(db, null, () => rows<{ owner_email: string }>(db, "select * from report_targets($1)", [SECRET]));
    expect(t.map((x) => x.owner_email)).toContain("owner@x.co");
    await rows(db, "insert into ledger_entries(business_id, type, direction, amount, method, account, description) values ($1,'sale_income',1,5000,'cash','cash','Venta'),($1,'expense',-1,1200,'cash','cash','Gasto')", [s.bid]);
    const [r] = await asUser(db, null, () => rows<{ d: { income: number; expenses: number } }>(db, "select report_data($1, $2, now() - interval '7 days', now() + interval '1 day') d", [SECRET, s.bid]));
    expect(r.d.income).toBe(5000);
    expect(r.d.expenses).toBe(1200);
  });
});
