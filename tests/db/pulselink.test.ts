import { describe, it, expect, beforeAll } from "vitest";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario } from "./harness";

let db: Db; let s: Scenario;
const SLUG = "barberia-test";
beforeAll(async () => { db = await createDb(); s = await seedScenario(db); });

describe("Pulse Link", () => {
  it("todo negocio tiene página pública aunque no haya bloques", async () => {
    const [r] = await asUser(db, null, () => rows<{ p: { business: { name: string }; blocks: unknown[] } }>(db, "select public_get_link_page($1) p", [SLUG]));
    expect(r.p.business.name).toBe("Barbería Test");
    expect(r.p.blocks).toEqual([]);
  });
  it("el dueño crea bloques; el público solo ve los activos y en orden", async () => {
    await asUser(db, s.owner, async () => {
      await rows(db, "insert into link_blocks(business_id, kind, label, url, sort_order) values ($1,'social','Instagram','https://instagram.com/test',1)", [s.bid]);
      await rows(db, "insert into link_blocks(business_id, kind, label, sort_order) values ($1,'title','Servicios',0)", [s.bid]);
      await rows(db, "insert into link_blocks(business_id, kind, label, url, sort_order, active) values ($1,'link','Oculto','https://x.co',2,false)", [s.bid]);
    });
    const [r] = await asUser(db, null, () => rows<{ p: { blocks: { label: string }[] } }>(db, "select public_get_link_page($1) p", [SLUG]));
    expect(r.p.blocks.map((b) => b.label)).toEqual(["Servicios", "Instagram"]);
  });
  it("un barbero no puede editar y un link inválido se rechaza", async () => {
    await expect(asUser(db, s.barberA, () => rows(db, "insert into link_blocks(business_id, kind, label, url) values ($1,'link','x','https://x.co')", [s.bid]))).rejects.toThrow();
    await expect(asUser(db, s.owner, () => rows(db, "insert into link_blocks(business_id, kind, label, url) values ($1,'link','x','javascript:alert(1)')", [s.bid]))).rejects.toThrow();
  });
  it("registra visitas y clics; ignora tipos raros y bloques ajenos; el anónimo no lee los eventos", async () => {
    const [blk] = await rows<{ id: string }>(db, "select id from link_blocks where label='Instagram'");
    await asUser(db, null, async () => {
      await rows(db, "select public_track_link($1,'view')", [SLUG]);
      await rows(db, "select public_track_link($1,'click',$2)", [SLUG, blk.id]);
      await rows(db, "select public_track_link($1,'hack')", [SLUG]);
      await rows(db, "select public_track_link($1,'click','00000000-0000-0000-0000-000000000000')", [SLUG]);
    });
    const ev = await rows<{ kind: string; block_id: string | null }>(db, "select kind, block_id from link_events order by id");
    expect(ev.map((e) => e.kind)).toEqual(["view", "click", "click"]);
    expect(ev[2].block_id).toBeNull();
    await expect(asUser(db, null, () => rows(db, "select * from link_events"))).rejects.toThrow();
    const seen = await asUser(db, s.owner, () => rows(db, "select * from link_events"));
    expect(seen).toHaveLength(3);
  });
});

describe("foto del barbero (0022)", () => {
  it("el catálogo público devuelve avatar_url", async () => {
    await db.exec(`update memberships set avatar_url = 'https://x.co/a.jpg' where id = '${s.mA}'`);
    const [r] = await asUser(db, null, () => rows<{ c: { barbers: { name: string; avatar_url: string | null }[] } }>(db, "select public_get_catalog($1) c", [SLUG]));
    expect(r.c.barbers.find((b) => b.name === "Juan Pérez")?.avatar_url).toBe("https://x.co/a.jpg");
  });
});
