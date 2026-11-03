import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/workerRpc", () => ({ workerRpc: () => rpc }));
vi.mock("@/lib/guard", () => ({ guard: () => null }));
import { GET } from "./route";

const KEY = "k".repeat(40);
const call = (auth?: string, qs = "") => GET(new Request(`http://x/api/admin/metrics${qs}`, { headers: auth ? { authorization: auth } : {} }));
beforeEach(() => { rpc.mockReset(); process.env.METRICS_API_KEY = KEY; });

describe("GET /api/admin/metrics", () => {
  it("sin clave configurada responde 503 y sin credencial 401", async () => {
    delete process.env.METRICS_API_KEY;
    expect((await call(`Bearer ${KEY}`)).status).toBe(503);
    process.env.METRICS_API_KEY = KEY;
    expect((await call()).status).toBe(401);
    expect((await call("Bearer otra")).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("una clave corta no se acepta aunque coincida", async () => {
    process.env.METRICS_API_KEY = "corta";
    const r = await call("Bearer corta");
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: "clave_muy_corta" });
  });
  it("con la clave devuelve las métricas y el MRR por moneda, sin active_subs", async () => {
    rpc.mockResolvedValue({ data: { signups: { total: 3 }, active_subs: [{ currency: "USD", addons: ["whatsapp"] }, { currency: "ARS", addons: [] }, { currency: "COP", addons: [] }], events: [] }, error: null });
    const r = await call(`Bearer ${KEY}`);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.signups.total).toBe(3);
    expect(j.active_subs).toBeUndefined();
    expect(j.mrr).toEqual({ USD: 3000 + 1500, ARS: 2100000 });
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
  it("`since` inválido o muy viejo se acota", async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    await call(`Bearer ${KEY}`, "?since=basura");
    await call(`Bearer ${KEY}`, "?since=2000-01-01");
    const [a, b] = rpc.mock.calls.map((c) => Date.parse(c[1].p_since));
    expect(Date.now() - a).toBeLessThan(8 * 86400000);
    expect(Date.now() - b).toBeLessThan(91 * 86400000);
  });
  it("si la base falla responde 502 sin detalles", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: "42883", message: "secret detail" } });
    const r = await call(`Bearer ${KEY}`);
    expect(r.status).toBe(502);
    expect(JSON.stringify(await r.json())).not.toContain("secret");
  });
});
