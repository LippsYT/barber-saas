/** Textos y reglas de la suscripción que también usa el navegador (sin importar el SDK de Stripe). */
export const STATUS_ES: Record<string, string> = {
  none: "Sin suscripción", trialing: "En prueba", active: "Activa", past_due: "Pago pendiente", unpaid: "Impaga",
  canceled: "Cancelada", incomplete: "Incompleta", incomplete_expired: "Vencida", paused: "En pausa",
};
/** Estados en que la barbería tiene el servicio al día. */
export const isPaid = (status: string | null | undefined) => status === "active" || status === "trialing";
