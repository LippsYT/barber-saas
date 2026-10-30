import type { LinkState } from "./parse";

export interface WhatsAppProvider {
  readonly id: "evolution" | "mock";
  /** true cuando no hay Evolution API y la vinculación no es real. */
  readonly demo: boolean;
  createInstance(instanceName: string): Promise<void>;
  /** Devuelve el código de 8 caracteres para vincular con el número. */
  connectPairing(instanceName: string, phoneDigits: string): Promise<string>;
  connectionState(instanceName: string): Promise<LinkState>;
  /** Envía texto. number = solo dígitos con código de país. */
  sendText(instanceName: string, number: string, text: string): Promise<SendResult>;
}

export interface SendResult { id: string; status?: string }
