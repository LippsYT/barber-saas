import type { LinkState } from "./parse";

export interface WhatsAppProvider {
  readonly id: "evolution" | "mock";
  /** true cuando no hay Evolution API y la vinculación no es real. */
  readonly demo: boolean;
  createInstance(instanceName: string): Promise<void>;
  /** Devuelve el código de 8 caracteres para vincular con el número. */
  connectPairing(instanceName: string, phoneDigits: string): Promise<string>;
  connectionState(instanceName: string): Promise<LinkState>;
}
