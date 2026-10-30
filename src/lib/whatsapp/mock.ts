import { mockPairingCode, type LinkState } from "./parse";
import type { WhatsAppProvider } from "./types";

/**
 * Sin red. El código es estable para el mismo número, pero no vincula WhatsApp.
 * La UI debe decir «modo demo» con claridad.
 */
export function createMockProvider(): WhatsAppProvider & { sent: { instanceName: string; number: string; text: string }[] } {
  const created = new Set<string>();
  const sent: { instanceName: string; number: string; text: string }[] = [];
  return {
    id: "mock",
    demo: true,
    async createInstance(instanceName) {
      created.add(instanceName);
    },
    async connectPairing(instanceName, phoneDigits) {
      created.add(instanceName);
      return mockPairingCode(instanceName, phoneDigits);
    },
    async connectionState(): Promise<LinkState> {
      return "connecting";
    },
    async sendText(instanceName, number, text) {
      sent.push({ instanceName, number, text });
      return { id: `MOCK-${sent.length}`, status: "MOCK" };
    },
    sent,
  };
}
