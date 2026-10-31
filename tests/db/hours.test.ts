import { describe, it, expect, beforeAll } from "vitest";
import { createDb, seedScenario, asUser, rows, type Db, type Scenario } from "./harness";

let db: Db; let s: Scenario; let day: string; let dow: number; let tz: string;
const SLUG = "barberia-test";
const slotsAt = async () => (await asUser(db, null, () => rows<{ t: string }>(db,
  "select to_char(slot_start at time zone $4, 'HH24:MI') t from public_get_availability($1,$2,$3::uuid[],$5::date) order by slot_start",
  [SLUG, s.mA, `{${s.corte}}`, tz, day]))).map((r) => r.t);

beforeAll(async () => {
  db = await createDb(); s = await seedScenario(db);
  tz = (await rows<{ timezone: string }>(db, "select timezone from businesses where id=$1", [s.bid]))[0].timezone;
  const d = (await rows<{ d: string; w: number }>(db, "select ((now() at time zone $1)::date + 3)::text d, extract(dow from (now() at time zone $1)::date + 3)::int w", [tz]))[0];
  day = d.d; dow = d.w;
  await rows(db, "insert into working_hours(business_id, member_id, weekday, start_time, end_time) values ($1,$2,$3,'08:00','20:00')", [s.bid, s.mA, dow]);
});

describe("Horario del negocio", () => {
  it("sin horario del negocio cuentan solo las horas del barbero", async () => {
    const t = await slotsAt();
    expect(t[0]).toBe("08:00"); expect(t.at(-1)).toBe("19:30");
  });
  it("el horario del negocio recorta la agenda del barbero", async () => {
    await asUser(db, s.owner, () => rows(db, "insert into business_hours(business_id, weekday, is_open, start_time, end_time) values ($1,$2,true,'10:00','12:00')", [s.bid, dow]));
    const t = await slotsAt();
    expect(t[0]).toBe("10:00"); expect(t.at(-1)).toBe("11:30");
  });
  it("un día cerrado no ofrece horarios", async () => {
    await asUser(db, s.owner, () => rows(db, "update business_hours set is_open=false where business_id=$1 and weekday=$2", [s.bid, dow]));
    expect(await slotsAt()).toEqual([]);
  });
  it("el día especial manda sobre el horario semanal", async () => {
    await asUser(db, s.owner, () => rows(db, "insert into special_days(business_id, on_date, closed, start_time, end_time, note) values ($1,$2,false,'14:00','16:00','Medio día')", [s.bid, day]));
    const t = await slotsAt();
    expect(t[0]).toBe("14:00"); expect(t.at(-1)).toBe("15:30");
    await asUser(db, s.owner, () => rows(db, "update special_days set closed=true where business_id=$1", [s.bid]));
    expect(await slotsAt()).toEqual([]);
  });
  it("el catálogo público expone horario y días especiales", async () => {
    const [r] = await asUser(db, null, () => rows<{ c: { business: { hours: { weekday: number; is_open: boolean }[]; special_days: { on_date: string; closed: boolean }[] } } }>(db, "select public_get_catalog($1) c", [SLUG]));
    expect(r.c.business.hours).toHaveLength(1);
    expect(r.c.business.special_days[0].closed).toBe(true);
  });
  it("un barbero no puede cambiar el horario; un día abierto exige horas válidas", async () => {
    await expect(asUser(db, s.barberA, () => rows(db, "insert into business_hours(business_id, weekday) values ($1,$2)", [s.bid, (dow + 1) % 7]))).rejects.toThrow();
    await expect(asUser(db, s.owner, () => rows(db, "insert into special_days(business_id, on_date, closed) values ($1,$2,false)", [s.bid, "2099-01-01"]))).rejects.toThrow();
  });
});
