/** Convierte fecha+hora local de una zona IANA a epoch ms UTC (sin dependencias). */
export function localToUtcMs(date: string, hhmm: string, tz: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offsetAt = (t: number) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(t))
      .reduce<Record<string, number>>((a, x) => (x.type !== "literal" ? { ...a, [x.type]: Number(x.value) } : a), {});
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t;
  };
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t);
  return t;
}

/** Fecha local YYYY-MM-DD de un instante en la zona. */
export function localDate(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}
export function localTime(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("es-CO", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
}
export function addDays(date: string, n: number): string {
  const t = Date.parse(date + "T00:00:00Z") + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
/** Lunes de la semana de `date`. */
export function weekStart(date: string): string {
  const wd = new Date(date + "T00:00:00Z").getUTCDay(); // 0=dom
  return addDays(date, -((wd + 6) % 7));
}
export function weekdayOf(date: string): number {
  return new Date(date + "T00:00:00Z").getUTCDay(); // 0=domingo (igual que working_hours.weekday)
}
