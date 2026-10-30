import { createEvolutionProvider } from "./evolution";
import { createMockProvider } from "./mock";
import type { WhatsAppProvider } from "./types";

export function evolutionEnv(): { url: string; key: string } | null {
  const url = process.env.EVOLUTION_API_URL?.trim();
  const key = process.env.EVOLUTION_API_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

/** Evolution si hay URL y clave. Si no, modo demo (MockProvider). */
export function getWhatsAppProvider(): WhatsAppProvider {
  const env = evolutionEnv();
  if (!env) return createMockProvider();
  return createEvolutionProvider({ baseUrl: env.url, apiKey: env.key });
}

export type { WhatsAppProvider } from "./types";
