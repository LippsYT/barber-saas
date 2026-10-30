import { parseEvolutionConnect, parseEvolutionState, type LinkState } from "./parse";
import type { WhatsAppProvider } from "./types";

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

function trimBase(url: string) {
  return url.replace(/\/+$/, "");
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!res.ok) {
    const brief = text.replace(/\s+/g, " ").slice(0, 180);
    throw new Error(`evolution_${res.status}${brief ? `: ${brief}` : ""}`);
  }
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new Error("evolution_bad_json"); }
}

/** Evolution API v2 (Baileys): instance/create, instance/connect?number, connectionState. */
export function createEvolutionProvider(cfg: EvolutionConfig): WhatsAppProvider {
  const base = trimBase(cfg.baseUrl);
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const headers = { apikey: cfg.apiKey, "Content-Type": "application/json" };

  async function call(path: string, init?: RequestInit): Promise<unknown> {
    const res = await fetchImpl(`${base}${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
    return readJson(res);
  }

  return {
    id: "evolution",
    demo: false,
    async createInstance(instanceName) {
      try {
        await call("/instance/create", {
          method: "POST",
          body: JSON.stringify({ instanceName, integration: "WHATSAPP-BAILEYS", qrcode: false }),
        });
      } catch (e) {
        const msg = (e as Error).message ?? "";
        if (msg.includes("403") || msg.includes("409") || /already/i.test(msg)) return;
        throw e;
      }
    },
    async connectPairing(instanceName, phoneDigits) {
      const body = await call(`/instance/connect/${encodeURIComponent(instanceName)}?number=${encodeURIComponent(phoneDigits)}`);
      return parseEvolutionConnect(body);
    },
    async connectionState(instanceName): Promise<LinkState> {
      const body = await call(`/instance/connectionState/${encodeURIComponent(instanceName)}`);
      return parseEvolutionState(body);
    },
  };
}
