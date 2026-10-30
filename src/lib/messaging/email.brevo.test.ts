import { describe, it, expect, vi } from "vitest";
import { createBrevoProvider, getEmailProvider, parseFrom } from "./email";

describe("parseFrom", () => {
  it("Name <email>", () => expect(parseFrom("Pulso <hola@pulso.app>")).toEqual({ name: "Pulso", email: "hola@pulso.app" }));
  it("quoted name", () => expect(parseFrom('"Barbería X" <x@y.com>')).toEqual({ name: "Barbería X", email: "x@y.com" }));
  it("plain", () => expect(parseFrom(" a@b.com ")).toEqual({ email: "a@b.com" }));
});

describe("Brevo provider", () => {
  it("POSTs v3 smtp/email with api-key and parsed sender", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ messageId: "<abc@brevo>" }), { status: 201 }));
    const p = createBrevoProvider("k-test", "Pulso <hola@pulso.app>", f as unknown as typeof fetch);
    const r = await p.send({ to: "c@d.com", subject: "S", text: "T", ics: "BEGIN:VCALENDAR" });
    expect(r.id).toBe("<abc@brevo>");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("k-test");
    const body = JSON.parse(init.body as string);
    expect(body.sender).toEqual({ name: "Pulso", email: "hola@pulso.app" });
    expect(body.to).toEqual([{ email: "c@d.com" }]);
    expect(body.textContent).toBe("T");
    expect(body.attachment[0].name).toBe("cita.ics");
  });
  it("throws on error", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ message: "unauthorized" }), { status: 401 }));
    await expect(createBrevoProvider("k", "a@b.com", f as unknown as typeof fetch).send({ to: "c@d.com", subject: "s", text: "t" }))
      .rejects.toThrow(/brevo_401/);
  });
});

describe("getEmailProvider selection", () => {
  it("brevo > resend > mock", () => {
    expect(getEmailProvider({ BREVO_API_KEY: "b", RESEND_API_KEY: "r", EMAIL_FROM: "a@b.com" }).id).toBe("brevo");
    expect(getEmailProvider({ RESEND_API_KEY: "r" }).id).toBe("resend");
    expect(getEmailProvider({}).id).toBe("mock");
  });
});
