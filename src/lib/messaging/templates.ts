/** Mismos textos que en SQL (0004/0015). Sirven para la vista previa en Ajustes y para tests. */
export const REACTIVATION_DEFAULT_DAYS = 25;
export function reactivationText(name: string, days: number, business: string, link: string) {
  return `Hola ${name}, ya pasaron ${days} días desde tu último corte en ${business}. ¿Agendamos el próximo? Reservá acá: ${link}`;
}
export function cancellationText(name: string, business: string, when: string, link: string) {
  return `Hola ${name}, tu cita en ${business} del ${when} fue cancelada. Si quieres, reserva otra: ${link}`;
}
export function confirmationText(name: string, business: string, barber: string, when: string, cancelPath: string) {
  return `¡Listo ${name}! Tu cita en ${business} con ${barber} es el ${when}. Para cancelar: ${cancelPath}`;
}
export function reminderText(name: string, business: string, when: string) {
  return `Hola ${name}, te recordamos tu cita en ${business} el ${when}.`;
}
export function reactivationSettings(settings: unknown): { enabled: boolean; days: number } {
  const r = (settings as { reactivation?: { enabled?: unknown; days?: unknown } } | null)?.reactivation;
  const days = Number(r?.days);
  return { enabled: r?.enabled === true, days: Number.isInteger(days) && days >= 7 && days <= 365 ? days : REACTIVATION_DEFAULT_DAYS };
}
