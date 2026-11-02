/** Correos con la marca de Pulso: tablas y estilos en línea (así los leen Gmail, Outlook y el celular). */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface BrandedEmail {
  /** Texto corto que se ve en la bandeja antes de abrir el correo. */
  preheader?: string;
  title: string;
  /** Párrafos de texto (se escapan). */
  paragraphs?: string[];
  /** HTML ya armado y seguro para los párrafos (lo usa quien necesita negritas o enlaces). */
  rawHtml?: string;
  /** Filas «etiqueta · valor». */
  rows?: [string, string][];
  cta?: { label: string; url: string };
  /** Letra chica bajo el botón. */
  note?: string;
  /** Si es true, `title`, `paragraphs`, `cta.url` y `note` se dejan tal cual (para plantillas de Supabase con {{ .ConfirmationURL }}). */
  template?: boolean;
}

const INK = "#070B14", LIME = "#D6FF4A", BLUE = "#2F5BFF", MUTED = "#5B6475", BG = "#EEF0F4";

export function brandedEmail(e: BrandedEmail): string {
  const t = (s: string) => (e.template ? s : esc(s));
  const paragraphs = (e.paragraphs ?? []).map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:${INK};">${t(p)}</p>`).join("");
  const rows = e.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;background:#F6F7FA;border-radius:14px;">${e.rows
        .map(([k, v], i) => `<tr><td style="padding:12px 16px;font-size:13px;color:${MUTED};${i ? "border-top:1px solid #E6E9EF;" : ""}">${t(k)}</td><td align="right" style="padding:12px 16px;font-size:15px;font-weight:700;color:${INK};${i ? "border-top:1px solid #E6E9EF;" : ""}">${t(v)}</td></tr>`)
        .join("")}</table>`
    : "";
  const cta = e.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px;"><tr><td style="background:${LIME};border-radius:14px;"><a href="${e.template ? e.cta.url : esc(e.cta.url)}" style="display:inline-block;padding:15px 28px;font-size:16px;font-weight:800;color:${INK};text-decoration:none;">${t(e.cta.label)}</a></td></tr></table>`
    : "";
  const note = e.note ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${MUTED};">${t(e.note)}</p>` : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${t(e.title)}</title></head>
<body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${t(e.preheader ?? e.title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="background:${INK};border-radius:22px 22px 0 0;padding:22px 28px;"><span style="display:inline-block;background:${BLUE};border-radius:9px;width:30px;height:30px;line-height:30px;text-align:center;font-size:17px;color:#fff;vertical-align:middle;">&#9829;</span><span style="vertical-align:middle;margin-left:10px;font-family:Arial Black,Helvetica,Arial,sans-serif;font-size:22px;font-weight:900;letter-spacing:.5px;color:#fff;">PULSO</span></td></tr>
<tr><td style="background:#fff;border-radius:0 0 22px 22px;padding:30px 28px 28px;font-family:Helvetica,Arial,sans-serif;">
<h1 style="margin:0 0 16px;font-family:Arial Black,Helvetica,Arial,sans-serif;font-size:26px;line-height:1.15;color:${INK};">${t(e.title)}</h1>
${paragraphs}${e.rawHtml ?? ""}${rows}${cta}${note}
</td></tr>
<tr><td style="padding:18px 8px 0;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};">Pulso · agenda, caja y reservas para barberías.<br>Si no esperabas este correo, puedes ignorarlo.</td></tr>
</table></td></tr></table></body></html>`;
}

/** Texto de WhatsApp (con *negritas* y enlaces) → HTML seguro para el cuerpo del correo. */
export function whatsappToHtml(text: string): string {
  return text.split(/\n{2,}/).map((block) => {
    const html = esc(block).replace(/\*([^*\n]+)\*/g, "<b>$1</b>").replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:${BLUE};">${u}</a>`).replace(/\n/g, "<br>");
    return `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:${INK};">${html}</p>`;
  }).join("");
}
