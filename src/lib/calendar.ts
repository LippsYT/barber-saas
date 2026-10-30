/** .ics (RFC 5545) y link de Google Calendar para una cita. Horas en UTC (Z) + X-WR-TIMEZONE del negocio. */
export interface CalEvent {
  uid: string; start: string; end: string; title: string; location?: string | null; description?: string; url?: string; timezone?: string;
}

const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Pliega líneas a 75 octetos (RFC 5545 §3.1). */
function fold(line: string): string {
  const out: string[] = []; let cur = ""; let bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(e: CalEvent, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pulso//Citas//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    ...(e.timezone ? [`X-WR-TIMEZONE:${e.timezone}`] : []),
    "BEGIN:VEVENT",
    `UID:${e.uid}@pulso`,
    `DTSTAMP:${utc(now.toISOString())}`,
    `DTSTART:${utc(e.start)}`,
    `DTEND:${utc(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Recordatorio de cita", "TRIGGER:-PT2H", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: CalEvent): string {
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${utc(e.start)}/${utc(e.end)}` });
  if (e.description) p.set("details", e.description);
  if (e.location) p.set("location", e.location);
  if (e.timezone) p.set("ctz", e.timezone);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
