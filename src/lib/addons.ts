/** Complementos de la suscripción de Pulso. Seguro de importar en el cliente (no usa Stripe). Precios en centavos de USD al mes. */
export type AddonKey = "whatsapp" | "resenas" | "marketing" | "informes" | "inventario";

export interface Addon {
  key: AddonKey;
  name: string;
  price: number;
  /** Una línea para la lista. */
  summary: string;
  /** Párrafo de la ficha. */
  description: string;
  /** «Qué incluye» de la ficha. */
  features: string[];
  /** Otro complemento que tiene que estar activo para que este sirva. */
  needs?: AddonKey;
}

/** Plan base: lo que incluye todo negocio suscrito. */
export const PLAN_NAME = "Plan Pulso";
export const BASE_PRICE = 1500;
export const BASE_FEATURES = ["Agenda y reservas online con tu link", "Pulse Link para redes sociales", "Caja diaria, gastos y adelantos", "Equipo, comisiones y propinas", "Clientes y libro de caja", "Notificaciones en tu celular"];

export const ADDONS: Addon[] = [
  {
    key: "whatsapp", name: "Recordatorios por WhatsApp", price: 1500,
    summary: "Confirmaciones y recordatorios a tus clientes.",
    description: "Tus clientes reciben por WhatsApp la confirmación de su cita y los recordatorios, sin que tú escribas un mensaje. Menos citas olvidadas, más agenda llena.",
    features: ["Confirmación al reservar", "Recordatorio 24 horas y 2 horas antes", "Aviso si se cancela la cita", "Textos que tú personalizas con el nombre y la hora", "Tu propio número de WhatsApp"],
  },
  {
    key: "resenas", name: "Reseñas en Google", price: 1500, needs: "whatsapp",
    summary: "Pide reseñas a tus clientes después de cada visita.",
    description: "Después de cada cita atendida, tu cliente recibe un mensaje con tu enlace de reseñas de Google. Más reseñas, más clientes nuevos que te encuentran.",
    features: ["Mensaje automático 2 horas después de la visita", "Con el enlace directo a tus reseñas", "Solo a clientes que aceptaron WhatsApp", "Lo activas o apagas cuando quieras"],
  },
  {
    key: "marketing", name: "Marketing avanzado", price: 1500, needs: "whatsapp",
    summary: "Trae de vuelta a los clientes que dejaron de venir.",
    description: "Pulso detecta a los clientes que llevan días sin volver y les escribe por ti para invitarlos a reservar otra vez.",
    features: ["Escribe solo a quien lleva días sin volver", "Tú eliges cuántos días y el mensaje", "Botón para reactivar a un cliente en el momento", "Nunca repite el mensaje al mismo cliente"],
  },
  {
    key: "informes", name: "Informes y PDF", price: 1500,
    summary: "Tu caja y tu negocio en un reporte listo para guardar.",
    description: "Descarga el reporte diario de caja en PDF, con el detalle por barbero, propinas y adelantos, y recibe el resumen de la semana en tu correo.",
    features: ["PDF diario de caja con gráfico y detalle por barbero", "Informe semanal por email con PDF", "Propinas y adelantos de cada persona", "Servicios que hizo cada barbero"],
  },
  {
    key: "inventario", name: "Inventario y proveedores", price: 1500,
    summary: "Controla tus productos y cuándo reponerlos.",
    description: "Lleva el stock de tus productos, recibe alerta cuando se acaban y ten a mano a tus proveedores.",
    features: ["Productos con stock y stock mínimo", "Alerta de producto por agotarse", "Proveedores y categorías"],
  },
];

/** Complementos que vienen en camino: se muestran en la lista pero todavía no se pueden contratar. */
export interface SoonAddon { key: string; name: string; price: number; description: string; features: string[] }
export const SOON: SoonAddon[] = [
  {
    key: "facturacion", name: "Facturación electrónica", price: 1500,
    description: "Emite la factura de cada venta desde Pulso, sin llenar nada a mano.",
    features: ["Factura a partir de cada cobro", "Datos fiscales de tu negocio y de tus clientes", "Envío de la factura al cliente"],
  },
  {
    key: "campos", name: "Campos personalizados", price: 1500,
    description: "Captura la información que tu negocio necesita en reservas y perfiles de clientes.",
    features: ["Recoge la información que realmente necesitas", "Agrega preguntas específicas para tus reservas", "Recibe la información anticipadamente para preparar cada cita sin improvisaciones ni pérdida de tiempo"],
  },
  {
    key: "pixeles", name: "Píxeles personalizados", price: 1500,
    description: "Conecta tus herramientas de medición para entender qué campañas generan reservas.",
    features: ["Mide cada acción de tus clientes", "Optimiza tus anuncios con datos reales", "Escala tus campañas con mayor precisión", "Integración fácil y sin procesos técnicos"],
  },
  {
    key: "asistente", name: "Asistente IA", price: 5000,
    description: "Un asistente virtual que atiende a tus clientes por WhatsApp y agenda citas por ti.",
    features: ["Atiende a tus clientes 24/7 por WhatsApp", "Agenda citas por ti en tiempo real", "Respuestas instantáneas y profesionales", "Más reservas sin más esfuerzo", "Tu asistente virtual siempre activo"],
  },
];

export const addonOf = (key: string) => ADDONS.find((a) => a.key === key);
export const isAddonKey = (key: string): key is AddonKey => ADDONS.some((a) => a.key === key);
export const addonsTotal = (keys: readonly string[]) => ADDONS.filter((a) => keys.includes(a.key)).reduce((s, a) => s + a.price, 0);
/** Total al mes: plan base más los complementos elegidos. */
export const monthlyTotal = (keys: readonly string[]) => BASE_PRICE + addonsTotal(keys);
/** Los complementos de los que dependen los elegidos también entran (reseñas y marketing necesitan WhatsApp). */
export const withNeeds = (keys: readonly AddonKey[]): AddonKey[] => {
  const all = new Set<AddonKey>(keys);
  for (const k of keys) { const n = addonOf(k)?.needs; if (n) all.add(n); }
  return ADDONS.map((a) => a.key).filter((k) => all.has(k));
};
/** `lookup_key` del precio de Stripe de cada complemento: se crea solo la primera vez que alguien lo contrata. */
export const addonLookupKey = (key: AddonKey) => `pulso_addon_${key}`;
export const keyFromLookup = (lookup: string | null | undefined): AddonKey | null => {
  if (!lookup?.startsWith("pulso_addon_")) return null;
  const k = lookup.slice("pulso_addon_".length);
  return isAddonKey(k) ? k : null;
};
