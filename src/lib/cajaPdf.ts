import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { TeamRow } from "@/lib/cajaTeam";

/** Reporte diario de caja en PDF (A4). Todos los montos llegan en centavos. */
export interface CajaPdfData {
  business: string;
  dayLabel: string;
  locked: boolean;
  serviceIncome: number;
  tips: number;
  income: number;
  expenses: number;
  net: number;
  byMethod: { cash: { in: number; out: number }; transfer: { in: number; out: number } };
  services: { name: string; qty: number; unitPrice: number; total: number }[];
  expensesList: { description: string; method: string; amount: number }[];
  /** null = quien descarga no puede ver pagos del equipo. */
  team: TeamRow[] | null;
  expectedCash: number;
  close: { counted: number; difference: number; notes?: string | null } | null;
}

const W = 595, H = 842, M = 40, CW = W - M * 2;
const INK = rgb(0.027, 0.043, 0.078), BLUE = rgb(0.184, 0.357, 1), LIME = rgb(0.839, 1, 0.29), GREEN = rgb(0.078, 0.58, 0.29), RED = rgb(0.72, 0.1, 0.2);
const MUTED = rgb(0.42, 0.45, 0.52), SOFT = rgb(0.955, 0.945, 0.91), LINE = rgb(0.88, 0.87, 0.84), WHITE = rgb(1, 1, 1);
const METHOD: Record<string, string> = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", other: "Otro" };

export function pdfMoney(cents: number): string {
  const n = Math.round(Number(cents) || 0);
  const s = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n) / 100);
  return `${n < 0 ? "-" : ""}US$ ${s}`;
}

/** Los PDF estándar solo dibujan Latin-1: se cambian los símbolos que no existen allí. */
const safe = (s: string) => s.replace(/[−–—]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

export async function buildCajaPdf(d: CajaPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages: PDFPage[] = [];
  let page!: PDFPage; let y = 0;

  const fit = (s: string, f: PDFFont, size: number, max: number) => {
    let t = safe(s);
    if (f.widthOfTextAtSize(t, size) <= max) return t;
    while (t.length > 1 && f.widthOfTextAtSize(t + "...", size) > max) t = t.slice(0, -1);
    return t.trimEnd() + "...";
  };
  const text = (s: string, x: number, yy: number, size: number, f: PDFFont = font, color = INK, max?: number) =>
    page.drawText(max ? fit(s, f, size, max) : safe(s), { x, y: yy, size, font: f, color });
  const right = (s: string, xr: number, yy: number, size: number, f: PDFFont = font, color = INK) =>
    page.drawText(safe(s), { x: xr - f.widthOfTextAtSize(safe(s), size), y: yy, size, font: f, color });

  const header = () => {
    page.drawRectangle({ x: 0, y: H - 112, width: W, height: 112, color: INK });
    page.drawRectangle({ x: 0, y: H - 116, width: W, height: 4, color: LIME });
    text("PULSO", M, H - 38, 11, bold, LIME);
    text("Reporte diario de caja", M, H - 70, 26, bold, WHITE);
    text(d.business, M, H - 92, 12, font, rgb(0.78, 0.82, 0.92), CW - 190);
    right(d.dayLabel, W - M, H - 92, 12, bold, LIME);
    y = H - 150;
  };
  const newPage = (withHeader = false) => {
    page = pdf.addPage([W, H]); pages.push(page);
    if (withHeader) header(); else y = H - 60;
  };
  const need = (h: number) => { if (y - h < 64) newPage(); };

  const section = (title: string, hint?: string) => {
    need(54); y -= 10;
    page.drawRectangle({ x: M, y: y - 4, width: 4, height: 16, color: BLUE });
    text(title.toUpperCase(), M + 12, y, 11, bold, INK);
    if (hint) right(hint, W - M, y, 8.5, font, MUTED);
    y -= 22;
  };
  /** Tabla: columnas con ancho y alineación; la última columna va en negrita. */
  const table = (cols: { label: string; w: number; align?: "r" }[], rows: string[][], opts: { total?: string[]; red?: boolean[][] } = {}) => {
    const drawHead = () => {
      page.drawRectangle({ x: M, y: y - 6, width: CW, height: 20, color: SOFT });
      let x = M + 8;
      for (const c of cols) { c.align === "r" ? right(c.label.toUpperCase(), x + c.w - 8, y, 7.5, bold, MUTED) : text(c.label.toUpperCase(), x, y, 7.5, bold, MUTED); x += c.w; }
      y -= 22;
    };
    need(60); drawHead();
    rows.forEach((r, i) => {
      if (y < 84) { newPage(); drawHead(); }
      if (i % 2 === 1) page.drawRectangle({ x: M, y: y - 6, width: CW, height: 19, color: rgb(0.985, 0.98, 0.965) });
      let x = M + 8;
      cols.forEach((c, j) => {
        const color = opts.red?.[i]?.[j] ? RED : INK;
        c.align === "r" ? right(r[j], x + c.w - 8, y, 9.5, j === cols.length - 1 ? bold : font, color) : text(r[j], x, y, 9.5, font, INK, c.w - 12);
        x += c.w;
      });
      y -= 19;
    });
    if (opts.total) {
      page.drawLine({ start: { x: M, y: y + 10 }, end: { x: M + CW, y: y + 10 }, thickness: 1, color: INK });
      let x = M + 8;
      cols.forEach((c, j) => { c.align === "r" ? right(opts.total![j], x + c.w - 8, y - 6, 9.5, bold) : text(opts.total![j], x, y - 6, 9.5, bold); x += c.w; });
      y -= 24;
    }
    y -= 10;
  };

  newPage(true);

  // Resumen: lo que entró, lo que salió y lo que quedó.
  const bw = (CW - 20) / 3;
  const boxes: [string, string, string[], ReturnType<typeof rgb>][] = [
    ["Entró", pdfMoney(d.income), [`Servicios ${pdfMoney(d.serviceIncome)}`, `Propinas ${pdfMoney(d.tips)}`], GREEN],
    ["Salió", pdfMoney(d.expenses), ["Gastos del día"], RED],
    ["Quedó", pdfMoney(d.net), ["Entró menos salió"], d.net < 0 ? RED : INK],
  ];
  boxes.forEach(([label, value, subs, color], i) => {
    const x = M + i * (bw + 10);
    page.drawRectangle({ x, y: y - 62, width: bw, height: 78, color: SOFT });
    text(label.toUpperCase(), x + 12, y - 2, 8, bold, MUTED);
    text(value, x + 12, y - 26, 19, bold, color, bw - 20);
    subs.forEach((s, k) => text(s, x + 12, y - 42 - k * 11, 8, font, MUTED, bw - 20));
  });
  y -= 104;

  section("Cómo se pagó");
  table(
    [{ label: "Método", w: CW * 0.4 }, { label: "Entró", w: CW * 0.2, align: "r" }, { label: "Salió", w: CW * 0.2, align: "r" }, { label: "Neto", w: CW * 0.2, align: "r" }],
    (["cash", "transfer"] as const).map((m) => [METHOD[m], pdfMoney(d.byMethod[m].in), pdfMoney(d.byMethod[m].out), pdfMoney(d.byMethod[m].in - d.byMethod[m].out)]),
  );

  const nServ = d.services.reduce((s, l) => s + l.qty, 0);
  section("Servicios vendidos", `${nServ} en total`);
  if (!d.services.length) { text("No hubo servicios cobrados este día.", M + 8, y, 10, font, MUTED); y -= 26; }
  else table(
    [{ label: "Servicio", w: CW * 0.5 }, { label: "Cant.", w: CW * 0.1, align: "r" }, { label: "Precio", w: CW * 0.2, align: "r" }, { label: "Total", w: CW * 0.2, align: "r" }],
    d.services.map((l) => [l.name, String(l.qty), pdfMoney(l.unitPrice), pdfMoney(l.total)]),
    { total: ["Total servicios", String(nServ), "", pdfMoney(d.serviceIncome)] },
  );

  if (d.team) {
    section("Equipo: lo que se le debe a cada uno", "propinas y adelantos incluidos");
    if (!d.team.length) { text("Nadie tuvo movimientos este día.", M + 8, y, 10, font, MUTED); y -= 26; }
    else {
      const sum = (k: "services" | "commission" | "tips" | "advances" | "owed") => d.team!.reduce((s, r) => s + r[k], 0);
      table(
        [{ label: "Persona", w: CW * 0.26 }, { label: "Serv.", w: CW * 0.08, align: "r" }, { label: "Comisión", w: CW * 0.17, align: "r" }, { label: "Propinas", w: CW * 0.16, align: "r" }, { label: "Adelantos", w: CW * 0.16, align: "r" }, { label: "A pagar", w: CW * 0.17, align: "r" }],
        d.team.map((r) => [r.name, String(r.services), pdfMoney(r.commission), pdfMoney(r.tips), r.advances ? pdfMoney(-r.advances) : "-", pdfMoney(r.owed)]),
        {
          total: ["Total equipo", String(sum("services")), pdfMoney(sum("commission")), pdfMoney(sum("tips")), sum("advances") ? pdfMoney(-sum("advances")) : "-", pdfMoney(sum("owed"))],
          red: d.team.map((r) => [false, false, false, false, r.advances > 0, r.owed < 0]),
        },
      );
      need(34);
      text("Las propinas son de cada persona, no de la barbería. El adelanto se resta de lo que se le debe.", M + 8, y, 8.5, font, MUTED, CW - 16);
      y -= 24;
    }
  }

  section("Gastos del día", pdfMoney(d.expenses));
  if (!d.expensesList.length) { text("No se anotaron gastos este día.", M + 8, y, 10, font, MUTED); y -= 26; }
  else table(
    [{ label: "Concepto", w: CW * 0.55 }, { label: "Método", w: CW * 0.25 }, { label: "Monto", w: CW * 0.2, align: "r" }],
    d.expensesList.map((e) => [e.description, METHOD[e.method] ?? e.method, pdfMoney(e.amount)]),
    { total: ["Total gastos", "", pdfMoney(d.expenses)] },
  );

  section("Cierre de caja", d.locked ? "día cerrado" : "día abierto");
  need(100);
  page.drawRectangle({ x: M, y: y - 62, width: CW, height: 76, color: SOFT });
  text("Efectivo que debería haber", M + 14, y - 4, 9, font, MUTED);
  right(pdfMoney(d.expectedCash), W - M - 14, y - 4, 12, bold);
  if (d.close) {
    text("Efectivo contado", M + 14, y - 24, 9, font, MUTED); right(pdfMoney(d.close.counted), W - M - 14, y - 24, 12, bold);
    text("Diferencia", M + 14, y - 44, 9, font, MUTED);
    right(d.close.difference === 0 ? "Cuadra" : pdfMoney(d.close.difference), W - M - 14, y - 44, 12, bold, d.close.difference === 0 ? GREEN : RED);
    y -= 84;
    if (d.close.notes) { text(`Nota: ${d.close.notes}`, M + 8, y, 9, font, MUTED, CW - 16); y -= 18; }
  } else {
    text("El día sigue abierto: todavía no se contó el efectivo.", M + 14, y - 30, 10, font, MUTED);
    y -= 84;
  }

  const stamp = new Date().toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 44 }, end: { x: W - M, y: 44 }, thickness: 0.6, color: LINE });
    p.drawText(safe(`Generado con Pulso · ${stamp}`), { x: M, y: 30, size: 8, font, color: MUTED });
    const label = `Página ${i + 1} de ${pages.length}`;
    p.drawText(label, { x: W - M - font.widthOfTextAtSize(label, 8), y: 30, size: 8, font, color: MUTED });
  });
  return pdf.save();
}
