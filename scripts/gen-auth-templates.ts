/** Genera las plantillas de correo de Supabase Auth (supabase/email-templates/*.html) con la marca de Pulso. Se pegan en Authentication → Emails. */
import { writeFileSync } from "node:fs";
import { brandedEmail, type BrandedEmail } from "../src/lib/messaging/emailHtml";

const T: [string, string, string, BrandedEmail][] = [
  ["confirmar-cuenta", "Confirma tu correo", "Confirma tu cuenta · Pulso", { title: "Confirma tu correo", preheader: "Un toque y tu barbería queda lista.", paragraphs: ["¡Bienvenido a Pulso! Confirma tu correo para empezar a usar tu agenda, tu caja y tus reservas."], cta: { label: "Confirmar mi cuenta", url: "{{ .ConfirmationURL }}" }, note: "Si el botón no abre, copia este enlace en tu navegador: {{ .ConfirmationURL }}" }],
  ["invitacion", "Te invitaron a Pulso", "Te invitaron a Pulso", { title: "Te invitaron a una barbería", preheader: "Acepta la invitación para entrar.", paragraphs: ["Una barbería te invitó a usar Pulso. Acepta la invitación y crea tu contraseña para entrar a tu agenda."], cta: { label: "Aceptar invitación", url: "{{ .ConfirmationURL }}" }, note: "Si el botón no abre, copia este enlace en tu navegador: {{ .ConfirmationURL }}" }],
  ["enlace-magico", "Tu enlace para entrar", "Tu enlace para entrar a Pulso", { title: "Entra a Pulso", preheader: "Tu enlace para entrar, sin contraseña.", paragraphs: ["Toca el botón para entrar a tu cuenta. El enlace sirve una sola vez."], cta: { label: "Entrar a Pulso", url: "{{ .ConfirmationURL }}" }, note: "Si no lo pediste tú, ignora este correo: nadie entra sin tocar el enlace." }],
  ["restablecer-contrasena", "Restablece tu contraseña", "Restablece tu contraseña de Pulso", { title: "Restablece tu contraseña", preheader: "Crea una contraseña nueva en un minuto.", paragraphs: ["Pediste cambiar tu contraseña. Toca el botón y elige una nueva."], cta: { label: "Crear contraseña nueva", url: "{{ .ConfirmationURL }}" }, note: "Si no lo pediste tú, ignora este correo: tu contraseña no cambia. El enlace vence pronto y sirve una sola vez." }],
  ["cambio-de-correo", "Confirma tu nuevo correo", "Confirma tu nuevo correo en Pulso", { title: "Confirma tu nuevo correo", preheader: "Confirma el cambio de correo de tu cuenta.", paragraphs: ["Pediste cambiar el correo de tu cuenta de {{ .Email }} a {{ .NewEmail }}. Confírmalo con el botón."], cta: { label: "Confirmar cambio", url: "{{ .ConfirmationURL }}" }, note: "Si no lo pediste tú, ignora este correo." }],
  ["reautenticacion", "Tu código de seguridad", "Tu código de seguridad de Pulso", { title: "Tu código de seguridad", preheader: "Usa este código para confirmar que eres tú.", paragraphs: ["Usa este código para confirmar la acción:"], rawHtml: `<p style="margin:0 0 14px;font-family:Arial Black,Helvetica,Arial,sans-serif;font-size:34px;letter-spacing:6px;color:#070B14;">{{ .Token }}</p>`, note: "Si no lo pediste tú, ignora este correo." }],
];

const lines: string[] = ["# Plantillas de correo de Supabase Auth", "", "Generadas con `npx tsx scripts/gen-auth-templates.ts`. Se pegan en Supabase → Authentication → Emails (Templates): el **Subject** y el **Message body** (HTML).", ""];
for (const [file, , subject, spec] of T) {
  writeFileSync(`supabase/email-templates/${file}.html`, brandedEmail({ ...spec, template: true }));
  lines.push(`- \`${file}.html\` — Subject: **${subject}**`);
}
writeFileSync("supabase/email-templates/README.md", lines.join("\n") + "\n");
