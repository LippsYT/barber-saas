import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { SUPPORT_PHONE, supportLink } from "@/lib/legal";

export const metadata: Metadata = { title: "Términos de uso — Pulso", description: "Las reglas para usar Pulso: cuenta, suscripción, pagos, complementos y responsabilidades." };

export default function Terminos() {
  return (
    <LegalPage title="Términos de uso" intro="Estos términos regulan el uso de Pulso, la aplicación de agenda, caja y reservas para barberías. Al crear una cuenta o usar Pulso, aceptas estos términos.">
      <section><h2>1. Qué es Pulso</h2>
        <p>Pulso es una herramienta en línea para que una barbería administre su agenda, reservas, clientes, equipo, caja y mensajes. Pulso no presta servicios de barbería: cada negocio es responsable de los servicios que ofrece a sus clientes.</p></section>
      <section><h2>2. Tu cuenta</h2>
        <ul><li>Debes dar un correo válido y mantener tu contraseña en secreto. Lo que se haga con tu cuenta es responsabilidad tuya.</li><li>Debes ser mayor de edad y tener autoridad para actuar en nombre de tu negocio.</li><li>El dueño del negocio decide quién del equipo entra y con qué rol. Es responsable de avisar a su equipo del uso de Pulso.</li><li>Nos reservamos el derecho de suspender cuentas que incumplan estos términos o se usen para abusar del servicio.</li></ul></section>
      <section><h2>3. Prueba, suscripción y pagos</h2>
        <ul><li>Los negocios nuevos tienen una prueba gratuita de 15 días con todos los complementos.</li><li>Después de la prueba, Pulso se cobra por mes: el plan base más los complementos que elijas. Los precios se cobran en dólares (USD), pesos argentinos (ARS), reales (BRL) o euros (EUR), según el país del negocio, y se muestran dentro de la aplicación antes de confirmar. Los montos en ARS, BRL y EUR son fijos y los revisamos periódicamente.</li><li>Los pagos los procesa Stripe. Pulso no guarda los datos de tu tarjeta.</li><li>La suscripción se renueva sola cada mes hasta que la canceles. Puedes cambiar el plan, activar o quitar complementos y cancelar en <strong>Ajustes → Suscripción</strong>.</li><li>Si cancelas, conservas el acceso hasta el final del periodo que ya pagaste. No devolvemos periodos ya iniciados, salvo que la ley lo exija.</li><li>Si un pago falla, podemos limitar el uso de la aplicación hasta que se regularice. Tus datos no se borran por eso.</li><li>Podemos cambiar los precios o los complementos. Te avisaremos dentro de la aplicación antes de que el cambio te afecte.</li></ul></section>
      <section><h2>4. Complementos</h2>
        <p>Algunos módulos, como los recordatorios por WhatsApp, las reseñas, el marketing, los informes y el inventario, son complementos que se cobran aparte. Los complementos marcados como <strong>Próximamente</strong> todavía no se pueden contratar ni cobrar.</p></section>
      <section><h2>5. Mensajes a tus clientes</h2>
        <ul><li>Tú decides a qué clientes escribes. Debes tener su permiso para enviarles mensajes por WhatsApp y respetar si piden no recibirlos.</li><li>Pulso envía los mensajes desde el número de WhatsApp que tú conectas. Respetar las reglas de WhatsApp y de Meta es tu responsabilidad.</li><li>No uses Pulso para spam, engaños, contenido ilegal ni para escribir a personas que no son tus clientes.</li></ul></section>
      <section><h2>6. Tus datos y los de tus clientes</h2>
        <p>Los datos de tu negocio y de tus clientes son tuyos. Pulso los trata por encargo tuyo, solo para prestarte el servicio, como explica la <Link className="underline" href="/privacidad">política de privacidad</Link>. Tú eres responsable de que la información que cargas sea lícita y de tener permiso para usarla.</p></section>
      <section><h2>7. Uso aceptable</h2>
        <p>No debes: intentar entrar a cuentas o datos de otros negocios, saturar o atacar el servicio, copiar o revender Pulso sin permiso, ni usarlo para actividades ilegales. Si encuentras una falla de seguridad, avísanos por WhatsApp para corregirla.</p></section>
      <section><h2>8. Disponibilidad y límites</h2>
        <p>Trabajamos para que Pulso esté disponible siempre, pero no garantizamos que funcione sin interrupciones ni errores. Pueden ocurrir mantenimientos o fallas de terceros (internet, WhatsApp, proveedores de pago). Haz copias de la información que consideres crítica.</p>
        <p>En la medida que permita la ley, Pulso no responde por pérdidas indirectas, como ventas no realizadas, y su responsabilidad total se limita a lo que hayas pagado por el servicio en los últimos tres meses.</p></section>
      <section><h2>9. Cierre de la cuenta</h2>
        <p>Puedes dejar de usar Pulso cuando quieras. Para pedir que cerremos tu cuenta y borremos tus datos, escríbenos por WhatsApp.</p></section>
      <section><h2>10. Cambios a estos términos</h2>
        <p>Podemos actualizar estos términos. Si el cambio es importante, te avisaremos en la aplicación. Si sigues usando Pulso después del aviso, aceptas la versión nueva.</p></section>
      <section><h2>11. Ley aplicable</h2>
        <p>Estos términos se rigen por las leyes de la República del Ecuador. Para cualquier controversia, las partes buscarán primero resolverla de buena fe; si no es posible, se someterán a los jueces competentes del Ecuador.</p></section>
      <section><h2>12. Contacto</h2>
        <p>Escríbenos por <a className="underline" href={supportLink()} target="_blank" rel="noopener noreferrer">WhatsApp al {SUPPORT_PHONE}</a>.</p></section>
    </LegalPage>
  );
}
