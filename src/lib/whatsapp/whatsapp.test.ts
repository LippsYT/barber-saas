import { describe, expect, it } from "vitest";
import { createEvolutionProvider } from "./evolution";
import { createMockProvider } from "./mock";
import { instanceNameFor, mockPairingCode, normalizePairingCode, normalizePhone, parseEvolutionConnect, parseEvolutionState } from "./parse";

describe("código de emparejamiento", () => {
  it("normaliza a 8 caracteres", () => {
    expect(normalizePairingCode("ab12-cd34")).toBe("AB12CD34");
    expect(normalizePairingCode("WZYEH1YYEXTRA")).toBe("WZYEH1YY");
    expect(() => normalizePairingCode("abc")).toThrow(/pairing_code_short/);
  });
  it("el mock es estable, de 8 caracteres, y no llama a la red", async () => {
    expect(mockPairingCode("pulso-house-davidson", "593999111222")).toMatch(/^[A-Z0-9]{8}$/);
    expect(mockPairingCode("pulso-house-davidson", "593999111222")).toBe(mockPairingCode("pulso-house-davidson", "593999111222"));
    const mock = createMockProvider();
    expect(mock.demo).toBe(true);
    const code = await mock.connectPairing("pulso-demo", "593999111222");
    expect(code).toHaveLength(8);
    expect(await mock.connectionState("pulso-demo")).toBe("connecting");
  });
  it("rechaza teléfonos imposibles", () => {
    expect(normalizePhone("+593 99 911 1222")).toBe("593999111222");
    expect(() => normalizePhone("123")).toThrow(/invalid_phone/);
  });
  it("arma el nombre de instancia", () => {
    expect(instanceNameFor("House Davidson")).toBe("pulso-housedavidson");
    expect(instanceNameFor("house-davidson")).toBe("pulso-house-davidson");
  });
});

describe("Evolution API v2", () => {
  it("lee pairingCode y connectionState", () => {
    expect(parseEvolutionConnect({ pairingCode: "ABCD-EFGH", code: "2@largo" })).toBe("ABCDEFGH");
    expect(parseEvolutionState({ instance: { instanceName: "x", state: "open" } })).toBe("open");
    expect(parseEvolutionState({ state: "connecting" })).toBe("connecting");
    expect(parseEvolutionState({})).toBe("close");
    expect(() => parseEvolutionConnect({ code: "solo-qr" })).toThrow(/pairing_code_missing/);
  });

  it("create, connect con number y connectionState usan los paths v2", async () => {
    const calls: { url: string; method?: string; body?: string }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), method: init?.method, body: init?.body as string | undefined });
      const url = String(input);
      if (url.endsWith("/instance/create")) return new Response("{}", { status: 201 });
      if (url.includes("/instance/connect/")) return new Response(JSON.stringify({ pairingCode: "QWER-TY12" }), { status: 200 });
      if (url.includes("/instance/connectionState/")) return new Response(JSON.stringify({ instance: { state: "open" } }), { status: 200 });
      return new Response("no", { status: 404 });
    };
    const p = createEvolutionProvider({ baseUrl: "https://evo.example/api/", apiKey: "sekrit", fetchImpl });
    expect(p.demo).toBe(false);
    await p.createInstance("pulso-house-davidson");
    const code = await p.connectPairing("pulso-house-davidson", "593999111222");
    const state = await p.connectionState("pulso-house-davidson");
    expect(code).toBe("QWERTY12");
    expect(state).toBe("open");
    expect(calls[0].url).toBe("https://evo.example/api/instance/create");
    expect(calls[0].method).toBe("POST");
    expect(JSON.parse(calls[0].body!)).toMatchObject({ instanceName: "pulso-house-davidson", integration: "WHATSAPP-BAILEYS", qrcode: false });
    expect(calls[1].url).toContain("/instance/connect/pulso-house-davidson?number=593999111222");
    expect(calls[2].url).toContain("/instance/connectionState/pulso-house-davidson");
    const headers = new Headers();
    expect(calls.every((c) => !c.url.includes("sekrit"))).toBe(true);
    void headers;
  });

  it("si la instancia ya existe, sigue", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      if (String(input).endsWith("/instance/create")) return new Response("already in use", { status: 403 });
      return new Response("{}", { status: 200 });
    };
    const p = createEvolutionProvider({ baseUrl: "https://evo.example", apiKey: "k", fetchImpl });
    await expect(p.createInstance("pulso-x")).resolves.toBeUndefined();
  });
});
