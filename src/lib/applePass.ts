/**
 * Apple Wallet vía WalletWallet (https://www.walletwallet.dev/docs/): firma el .pkpass con su certificado
 * en el plan Free (1.000 pases/mes, sin tarjeta). Se activa solo con WALLETWALLET_API_KEY.
 */
export interface PassInput { id: string; business: string; startsAt: string; timezone: string; service?: string; barber: string; address: string | null; url: string }

export const applePassEnabled = (env: Record<string, string | undefined> = process.env) => !!env.WALLETWALLET_API_KEY;

export function applePassBody(p: PassInput) {
  const d = new Date(p.startsAt);
  const fecha = new Intl.DateTimeFormat("es", { timeZone: p.timezone, weekday: "short", day: "numeric", month: "short" }).format(d);
  const hora = new Intl.DateTimeFormat("es", { timeZone: p.timezone, hour: "2-digit", minute: "2-digit" }).format(d);
  const end = new Date(d.getTime() + 24 * 3600e3);
  return {
    logoText: p.business.slice(0, 64),
    organizationName: p.business.slice(0, 64),
    description: `Cita en ${p.business}`,
    primaryFields: [{ label: "CITA", value: `${fecha} · ${hora}` }],
    secondaryFields: [{ label: "SERVICIO", value: p.service || "Cita" }, { label: "CON", value: p.barber }],
    backFields: [...(p.address ? [{ label: "Dirección", value: p.address }] : []), { label: "Ver o cancelar", value: p.url }],
    barcodeValue: p.url, barcodeFormat: "QR", barcodeAltText: "",
    colorPreset: "blue",
    expirationDate: end.toISOString(),
  };
}

export async function createApplePass(p: PassInput, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<{ pkpass: Uint8Array; shareUrl?: string }> {
  const r = await fetchImpl("https://api.walletwallet.dev/api/passes", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(applePassBody(p)),
  });
  const j = (await r.json().catch(() => ({}))) as { applePass?: string; shareUrl?: string; error?: string };
  if (!r.ok || !j.applePass) throw new Error(`walletwallet ${r.status}: ${j.error ?? "sin pase"}`);
  return { pkpass: Uint8Array.from(Buffer.from(j.applePass, "base64")), shareUrl: j.shareUrl };
}
