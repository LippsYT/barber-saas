/** Datos de contacto y fecha de los textos legales de Pulso. Un solo lugar para cambiarlos. */
export const SUPPORT_PHONE = "+593 99 540 7217";
export const SUPPORT_WA = "https://wa.me/593995407217";
export const supportLink = (text = "Hola, necesito ayuda con Pulso.") => `${SUPPORT_WA}?text=${encodeURIComponent(text)}`;
/** Última actualización de Términos y Privacidad. */
export const LEGAL_UPDATED = "1 de noviembre de 2026";
