import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";
import { addDays, localDate, localToUtcMs } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { emailPolicy, getEmailProvider } from "@/lib/messaging/email";
import { allowedToSend } from "@/lib/messaging/allowlist";

export interface ReportTarget { business_id: string; name: string; timezone: string; currency: string; owner_email: string }
export interface ReportData {
  income: number; tips: number; expenses: number; new_clients: number;
  appointments: Record<string, number>;
  top_services: { name: string; n: number; total: number }[];
  by_barber: { name: string; n: number }[];
}
export interface Period { from: string; to: string; label: string }

const BLUE = rgb(0x2f / 255, 0x5b / 255, 1), LIME = rgb(0xd6 / 255, 1, 0x4a / 255), INK = rgb(0.06, 0.08, 0.14), MUTED = rgb(0.4, 0.43, 0.5);
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const pretty = (d: string) => `${Number(d.slice(8))} ${MES[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

/** Los 7 días completos anteriores a hoy, en la zona del negocio. */
export function lastWeek(tz: string, now = Date.now()): Period {
  const today = localDate(now, tz), start = addDays(today, -7), last = addDays(today, -1);
  return { from: new Date(localToUtcMs(start, "00:00", tz)).toISOString(), to: new Date(localToUtcMs(today, "00:00", tz)).toISOString(), label: `${pretty(start)} – ${pretty(last)}` };
}

/** PDF de una página con el resumen del periodo. */
export async function buildReportPdf(biz: { name: string; currency: string }, period: Period, d: ReportData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold), font = await pdf.embedFont(StandardFonts.Helvetica);
  const money = (c: number) => formatMoney(c, biz.currency);
  const text = (p: PDFPage, s: string, x: number, y: number, size: number, f: PDFFont = font, color = INK) => p.drawText(s, { x, y, size, font: f, color });

  page.drawRectangle({ x: 0, y: 742, width: 595, height: 100, color: BLUE });
  text(page, "INFORME SEMANAL", 40, 800, 11, bold, LIME);
  text(page, biz.name.slice(0, 40), 40, 768, 24, bold, rgb(1, 1, 1));
  text(page, period.label, 40, 750, 11, font, rgb(1, 1, 1));

  const kpis: [string, string][] = [["Ingresos por ventas", money(d.income)], ["Propinas", money(d.tips)], ["Gastos y retiros", money(d.expenses)], ["Resultado", money(d.income + d.tips - d.expenses)]];
  kpis.forEach(([label, value], i) => {
    const x = 40 + (i % 2) * 260, y = 670 - Math.floor(i / 2) * 78;
    page.drawRectangle({ x, y, width: 235, height: 62, color: rgb(0.95, 0.96, 0.99) });
    text(page, label.toUpperCase(), x + 12, y + 44, 8, bold, MUTED);
    text(page, value, x + 12, y + 18, 20, bold);
  });

  const ap = d.appointments, done = ap.completed ?? 0, total = Object.values(ap).reduce((a, b) => a + b, 0);
  let y = 500;
  text(page, "CITAS", 40, y, 11, bold, BLUE); y -= 20;
  for (const [label, n] of [["Total de citas", total], ["Atendidas", done], ["Canceladas", ap.cancelled ?? 0], ["No asistieron", ap.no_show ?? 0], ["Clientes nuevos", d.new_clients]] as [string, number][]) {
    text(page, label, 40, y, 11); text(page, String(n), 250, y, 11, bold); y -= 17;
  }

  y -= 14; text(page, "SERVICIOS MÁS VENDIDOS", 40, y, 11, bold, BLUE); y -= 20;
  if (!d.top_services.length) { text(page, "Sin servicios atendidos en el periodo.", 40, y, 11, font, MUTED); y -= 17; }
  for (const s of d.top_services) { text(page, s.name.slice(0, 38), 40, y, 11); text(page, `${s.n}`, 330, y, 11, bold); text(page, money(s.total), 400, y, 11); y -= 17; }

  y -= 14; text(page, "ATENDIDAS POR BARBERO", 40, y, 11, bold, BLUE); y -= 20;
  if (!d.by_barber.length) { text(page, "Sin citas atendidas en el periodo.", 40, y, 11, font, MUTED); y -= 17; }
  for (const b of d.by_barber) { text(page, b.name.slice(0, 38), 40, y, 11); text(page, `${b.n}`, 330, y, 11, bold); y -= 17; }

  text(page, "Generado por Pulso. Los montos son de las ventas y gastos registrados en el libro de caja.", 40, 36, 8, font, MUTED);
  return pdf.save();
}

function rpc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, secret = process.env.CRON_SECRET;
  if (!url || !key || !secret) throw new Error("missing_env");
  const db = createClient(url, key, { auth: { persistSession: false } });
  return {
    async targets(): Promise<ReportTarget[]> {
      const { data, error } = await db.rpc("report_targets", { p_secret: secret });
      if (error) throw new Error(error.message);
      return (data ?? []) as ReportTarget[];
    },
    async data(business: string, p: Period): Promise<ReportData> {
      const { data, error } = await db.rpc("report_data", { p_secret: secret, p_business: business, p_from: p.from, p_to: p.to });
      if (error) throw new Error(error.message);
      return data as ReportData;
    },
  };
}
export const reportRpc = rpc;

/** Arma el PDF de la semana pasada y lo envía al dueño. Respeta EMAIL_SEND_ALLOWLIST. */
export async function sendWeeklyReport(t: ReportTarget): Promise<"sent" | "skipped"> {
  if (!allowedToSend(t.owner_email, emailPolicy())) return "skipped";
  const period = lastWeek(t.timezone);
  const d = await rpc().data(t.business_id, period);
  const pdf = await buildReportPdf({ name: t.name, currency: t.currency }, period, d);
  await getEmailProvider().send({
    to: t.owner_email,
    subject: `Informe semanal de ${t.name} · ${period.label}`,
    text: `Hola,\n\nAdjuntamos el informe semanal de ${t.name} (${period.label}).\n\nIngresos: ${formatMoney(d.income, t.currency)}\nGastos: ${formatMoney(d.expenses, t.currency)}\n\nPuedes apagar este correo en Pulso → Mensajes automáticos.\n`,
    attachments: [{ filename: `informe-${period.from.slice(0, 10)}.pdf`, content: Buffer.from(pdf).toString("base64"), contentType: "application/pdf" }],
  });
  return "sent";
}
