import { mockPairingCode, type LinkState } from "./parse";
import type { WhatsAppProvider } from "./types";

/**
 * Sin red. El código es estable para el mismo número, pero no vincula WhatsApp.
 * La UI debe decir «modo demo» con claridad.
 */
export function createMockProvider(): WhatsAppProvider {
  const created = new Set<string>();
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
  };
}
