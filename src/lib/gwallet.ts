/**
 * Google Wallet «Guardar en Google Wallet» (Generic pass) con JWT firmado RS256 por una cuenta de servicio.
 * Env: GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SA_KEY (JSON de la cuenta de servicio, o base64 de ese JSON).
 * Sin env → null (el botón se oculta).
 */
import { createSign } from "crypto";

export interface WalletAppt { id: string; business: string; startsAt: string; timezone: string; service?: string; barber?: string; address?: string | null; url: string }
interface SaKey { client_email: string; private_key: string }

export function walletConfig(env: Record<string, string | undefined> = process.env): { issuerId: string; sa: SaKey } | null {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID?.trim(); const raw = env.GOOGLE_WALLET_SA_KEY?.trim();
  if (!issuerId || !raw) return null;
  try {
    const sa = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")) as SaKey;
    return sa.client_email && sa.private_key ? { issuerId, sa } : null;
  } catch { return null; }
}

const b64u = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const tv = (v: string) => ({ defaultValue: { language: "es", value: v } });

export function walletPayload(issuerId: string, saEmail: string, a: WalletAppt, origin: string) {
  const when = new Date(a.startsAt).toLocaleString("es-EC", { timeZone: a.timezone, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const classId = `${issuerId}.pulso_cita`;
  const objectId = `${issuerId}.cita_${a.id.replace(/[^\w.-]/g, "_")}`;
  return {
    iss: saEmail, aud: "google", typ: "savetowallet", origins: [origin],
    payload: {
      genericClasses: [{ id: classId }],
      genericObjects: [{
        id: objectId, classId, state: "ACTIVE",
        cardTitle: tv(a.business), header: tv("Próxima cita"), subheader: tv(when),
        hexBackgroundColor: "#0B0F17",
        textModulesData: [
          ...(a.service ? [{ id: "servicio", header: "Servicio", body: a.service }] : []),
          ...(a.barber ? [{ id: "barbero", header: "Barbero", body: a.barber }] : []),
          ...(a.address ? [{ id: "direccion", header: "Dirección", body: a.address }] : []),
        ],
        barcode: { type: "QR_CODE", value: a.url },
        linksModuleData: { uris: [{ uri: a.url, description: "Ver o cancelar la cita", id: "cita" }] },
        validTimeInterval: { end: { date: new Date(Date.parse(a.startsAt) + 6 * 3600e3).toISOString() } },
      }],
    },
  };
}

export function signWalletJwt(payload: object, privateKey: string): string {
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const s = createSign("RSA-SHA256"); s.update(`${head}.${body}`);
  return `${head}.${body}.${s.sign(privateKey).toString("base64url")}`;
}

export function saveToWalletUrl(a: WalletAppt, origin: string, env: Record<string, string | undefined> = process.env): string | null {
  const cfg = walletConfig(env); if (!cfg) return null;
  return `https://pay.google.com/gp/v/save/${signWalletJwt(walletPayload(cfg.issuerId, cfg.sa.client_email, a, origin), cfg.sa.private_key)}`;
}
