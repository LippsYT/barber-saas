/** Código de país por defecto (Ecuador). El negocio puede tener otro en businesses.phone_country_code. */
export const DEFAULT_COUNTRY_CODE = "593";

/**
 * Normaliza a E.164 (+<código><número>). Misma regla que normalize_phone() en SQL (0012):
 * "+..." se respeta; "00..." es prefijo internacional; "0..." es número local (se quita el 0);
 * con 11+ dígitos se asume que ya trae código de país; si no, se antepone el código.
 */
export function toE164(input: string | null | undefined, cc: string = DEFAULT_COUNTRY_CODE): string | null {
  const s = (input ?? "").trim();
  const d = s.replace(/\D/g, "");
  const c = cc || DEFAULT_COUNTRY_CODE;
  if (!d) return null;
  if (s.startsWith("+")) return "+" + d;
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (d.startsWith("0")) return "+" + c + d.replace(/^0+/, "");
  if (d.length >= 11) return "+" + d; // ya trae código de país
  return "+" + c + d;
}

/** Link de WhatsApp (wa.me usa solo dígitos, sin "+"). */
export function waHref(phone: string | null | undefined, cc: string = DEFAULT_COUNTRY_CODE): string {
  const e = toE164(phone, cc);
  return e ? `https://wa.me/${e.slice(1)}` : "";
}
