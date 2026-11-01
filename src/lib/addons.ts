/** Complementos de la suscripción de Pulso. Seguro de importar en el cliente (no usa Stripe). Precios en centavos de USD al mes. */
export type AddonKey = "whatsapp" | "marketing" | "informes" | "inventario";

export interface Addon {
  key: AddonKey;
  name: string;
  price: number;
  summary: string;
  features: string[];
  /** Otro complemento que tiene que estar activo para que este sirva. */
  needs?: AddonKey;
}

/** Plan base: agenda, reservas online, Pulse Link, caja diaria, equipo y comisiones, clientes y avisos dentro de la app. */
export const BASE_PRICE = 1500;
export const BASE_FEATURES = ["Agenda y reservas online con tu link", "Pulse Link para redes sociales", "Caja diaria, gastos y adelantos", "Equipo, comisiones y propinas", "Clientes y libro de movimientos", "Notificaciones en tu celular"];

export const ADDONS: Addon[] = [
  {
    key: "whatsapp", name: "Mensajes por WhatsApp", price: 1500,
    summary: "Confirmaciones, recordatorios y avisos a tus clientes.",
    features: ["Confirmación al reservar", "Recordatorio 24 horas y 2 horas antes", "Aviso si se cancela la cita", "Pedido de reseña después de la visita", "Textos que tú personalizas"],
  },
  {
    key: "marketing", name: "Reactivación de clientes", price: 1500, needs: "whatsapp",
    summary: "Trae de vuelta a los clientes que dejaron de venir.",
    features: ["Escribe solo a quien lleva días sin volver", "Tú eliges cuántos días y el mensaje", "Botón para reactivar a un cliente en el momento", "Nunca repite el mensaje al mismo cliente"],
  },
  {
    key: "informes", name: "Informes y PDF", price: 1000,
    summary: "Tu caja y tu negocio en un reporte listo para guardar.",
    features: ["PDF diario de caja con gráfico y detalle por barbero", "Informe semanal por email con PDF", "Propinas y adelantos de cada persona", "Servicios que hizo cada barbero"],
  },
  {
    key: "inventario", name: "Inventario y proveedores", price: 1000,
    summary: "Controla tus productos y cuándo reponerlos.",
    features: ["Productos con stock y stock mínimo", "Alerta de producto por agotarse", "Proveedores y categorías"],
  },
];

export const addonOf = (key: string) => ADDONS.find((a) => a.key === key);
export const isAddonKey = (key: string): key is AddonKey => ADDONS.some((a) => a.key === key);
/** Total al mes: plan base más los complementos elegidos. */
export const monthlyTotal = (keys: readonly string[]) => BASE_PRICE + ADDONS.filter((a) => keys.includes(a.key)).reduce((s, a) => s + a.price, 0);
/** `lookup_key` del precio de Stripe de cada complemento: se crea solo la primera vez que alguien lo contrata. */
export const addonLookupKey = (key: AddonKey) => `pulso_addon_${key}`;
export const keyFromLookup = (lookup: string | null | undefined): AddonKey | null => {
  if (!lookup?.startsWith("pulso_addon_")) return null;
  const k = lookup.slice("pulso_addon_".length);
  return isAddonKey(k) ? k : null;
};
