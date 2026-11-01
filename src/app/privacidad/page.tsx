import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { SUPPORT_PHONE, supportLink } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidad — Pulso", description: "Qué datos guarda Pulso, para qué los usa, con quién los comparte y cómo puedes pedir su acceso o borrado." };

export default function Privacidad() {
  return (
    <LegalPage title="Privacidad" intro="Aquí explicamos qué datos trata Pulso, para qué, con quién los compartimos y qué derechos tienes. Cumplimos con la Ley Orgánica de Protección de Datos Personales del Ecuador.">
      <section><h2>Quién es quién</h2>
        <ul><li><strong>El negocio (la barbería)</strong> decide qué datos de sus clientes y de su equipo guarda. Es el responsable de esos datos.</li><li><strong>Pulso</strong> trata esos datos por encargo del negocio, solo para prestar el servicio. De los datos de la cuenta del dueño y del equipo (correo, acceso, suscripción) Pulso es responsable.</li></ul></section>
      <section><h2>Qué datos guardamos</h2>
        <ul><li><strong>Cuenta:</strong> correo, contraseña (guardada de forma protegida, nunca en texto claro) y el rol dentro del negocio.</li><li><strong>Negocio:</strong> nombre, enlace de reservas, horarios, servicios, precios, equipo, comisiones, caja, gastos y adelantos.</li><li><strong>Clientes:</strong> nombre, teléfono, historial de citas y, si el cliente lo aceptó, su permiso para recibir mensajes por WhatsApp.</li><li><strong>Mensajes:</strong> el texto, la fecha y el estado de los mensajes que Pulso envía en nombre del negocio.</li><li><strong>Notificaciones en el celular:</strong> si las activas, un identificador técnico de tu dispositivo para poder avisarte.</li><li><strong>Pagos:</strong> los datos de la tarjeta los guarda Stripe, no Pulso. Nosotros solo vemos el estado de la suscripción.</li><li><strong>Uso técnico:</strong> registros básicos del servidor para seguridad y para corregir errores.</li></ul></section>
      <section><h2>Para qué los usamos</h2>
        <ul><li>Darte la agenda, las reservas, la caja y los demás módulos.</li><li>Enviar confirmaciones, recordatorios y avisos que el negocio activó.</li><li>Cobrar la suscripción y gestionar los complementos.</li><li>Mantener la seguridad, evitar abusos y corregir fallas.</li><li>Responder a tus consultas de soporte.</li></ul>
        <p>No vendemos datos personales ni los usamos para publicidad de terceros.</p></section>
      <section><h2>Con quién los compartimos</h2>
        <p>Usamos proveedores que tratan datos solo para darnos su servicio:</p>
        <ul><li>Supabase: base de datos, acceso a la cuenta y archivos.</li><li>Vercel: alojamiento de la aplicación.</li><li>Stripe: cobro de la suscripción.</li><li>WhatsApp (Meta) y el proveedor de mensajería que conecta tu número: envío de mensajes de WhatsApp.</li><li>Servicio de correo: confirmaciones de cuenta e informes por email.</li><li>Google, Apple, Mozilla o Microsoft: entrega de las notificaciones push en tu dispositivo.</li></ul>
        <p>Algunos de estos proveedores están fuera del Ecuador, así que tus datos pueden tratarse en otros países. También podemos compartir datos si una autoridad competente lo exige conforme a la ley.</p></section>
      <section><h2>Cuánto tiempo los guardamos</h2>
        <p>Mientras tu cuenta esté activa. Si pides cerrarla, borramos o anonimizamos los datos, salvo lo que la ley nos obligue a conservar, como registros de cobro.</p></section>
      <section><h2>Seguridad</h2>
        <p>Cada negocio solo ve sus propios datos. Usamos conexiones cifradas, control de acceso por roles y revisiones de seguridad. Ningún sistema es infalible: si ocurre un incidente que te afecte, te avisaremos como exige la ley.</p></section>
      <section><h2>Tus derechos</h2>
        <p>Puedes pedir acceso, corrección, actualización, eliminación u oposición al tratamiento de tus datos, y retirar tu consentimiento cuando quieras. Si eres cliente de una barbería y no quieres recibir sus mensajes, díselo a la barbería o escríbenos y se lo hacemos saber.</p>
        <p>Para ejercer estos derechos escríbenos por <a className="underline" href={supportLink("Hola, quiero ejercer mis derechos sobre mis datos en Pulso.")} target="_blank" rel="noopener noreferrer">WhatsApp al {SUPPORT_PHONE}</a>. Si crees que no atendimos bien tu solicitud, puedes acudir a la Superintendencia de Protección de Datos Personales del Ecuador.</p></section>
      <section><h2>Menores de edad</h2>
        <p>Pulso es para negocios y no está dirigido a menores. Los negocios no deben registrar datos de menores sin autorización de quien los representa.</p></section>
      <section><h2>Cambios</h2>
        <p>Si cambiamos esta política, publicaremos la versión nueva aquí con su fecha. Los <Link className="underline" href="/terminos">términos de uso</Link> también aplican.</p></section>
    </LegalPage>
  );
}
