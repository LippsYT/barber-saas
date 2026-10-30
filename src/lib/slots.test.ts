import { describe, it, expect } from "vitest";
import { generateSlots } from "./slots";
import { localToUtcMs, localDate, weekStart } from "./time";

const tz = "America/Bogota"; // UTC−5 sin DST
const at = (h: string) => localToUtcMs("2026-11-02", h, tz);
const p = { windows: [{ start: at("09:00"), end: at("12:00") }], busy: [], durationMin: 30, stepMin: 30, now: at("00:00") - 86400000, minNoticeMin: 60, maxAdvanceDays: 60 };

describe("slots", () => {
  it("genera slots dentro del horario", () => {
    const s = generateSlots(p);
    expect(s).toHaveLength(6);
    expect(s[0].start).toBe(at("09:00"));
    expect(s.at(-1)!.end).toBe(at("12:00"));
  });
  it("excluye choques con citas/time_off", () => {
    const s = generateSlots({ ...p, busy: [{ start: at("09:30"), end: at("10:30") }] });
    expect(s.map((x) => x.start)).toEqual([at("09:00"), at("10:30"), at("11:00"), at("11:30")]);
  });
  it("duración larga: debe caber completa", () => {
    expect(generateSlots({ ...p, durationMin: 90 }).map((x) => x.start)).toEqual([at("09:00"), at("09:30"), at("10:00"), at("10:30")]);
  });
  it("anticipación mínima y máxima", () => {
    expect(generateSlots({ ...p, now: at("09:00"), minNoticeMin: 60 })[0].start).toBe(at("10:00"));
    expect(generateSlots({ ...p, now: at("09:00") - 90 * 86400000, maxAdvanceDays: 30 })).toHaveLength(0);
  });
});

describe("time", () => {
  it("zona Bogotá", () => {
    expect(new Date(at("09:00")).toISOString()).toBe("2026-11-02T14:00:00.000Z");
    expect(localDate(Date.parse("2026-11-03T03:00:00Z"), tz)).toBe("2026-11-02");
  });
  it("lunes de la semana", () => expect(weekStart("2026-11-01")).toBe("2026-10-26"));
});
