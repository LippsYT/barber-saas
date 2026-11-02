import { describe, it, expect } from "vitest";
import { brandedEmail, whatsappToHtml } from "./emailHtml";

describe("brandedEmail", () => {
  it("escapa el texto del usuario y arma el botón", () => {
    const h = brandedEmail({ title: "Hola <b>", paragraphs: ["a & b"], cta: { label: "Ir", url: "https://x.com/?a=1&b=2" }, rows: [["Ingresos", "US$ 5.00"]] });
    expect(h).toContain("Hola &lt;b&gt;"); expect(h).toContain("a &amp; b"); expect(h).toContain('href="https://x.com/?a=1&amp;b=2"'); expect(h).toContain("US$ 5.00");
    expect(h).not.toContain("<b>Hola");
  });
  it("en modo plantilla deja las variables de Supabase intactas", () => {
    const h = brandedEmail({ title: "T", cta: { label: "Ok", url: "{{ .ConfirmationURL }}" }, template: true });
    expect(h).toContain('href="{{ .ConfirmationURL }}"');
  });
});
describe("whatsappToHtml", () => {
  it("negritas, enlaces y saltos; escapa HTML", () => {
    const h = whatsappToHtml("Hola *Ana* <script>\nhttps://a.com/c/1\n\nChau");
    expect(h).toContain("<b>Ana</b>"); expect(h).toContain("&lt;script&gt;"); expect(h).toContain('<a href="https://a.com/c/1"'); expect(h.match(/<p /g)?.length).toBe(2);
  });
});
