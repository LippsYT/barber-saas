import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { LegalPage } from "@/components/legal/LegalPage";
import { SUPPORT_PHONE, supportLink } from "@/lib/legal";

export const metadata: Metadata = { title: "Soporte — Pulso", description: "Escríbenos por WhatsApp y te ayudamos con tu cuenta, tu agenda o tu suscripción." };

export default function Soporte() {
  return (
    <LegalPage title="Soporte" intro="Si algo no funciona o tienes una duda, escríbenos. Te respondemos por WhatsApp." updated={false}>
      <a href={supportLink()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl bg-[#2F5BFF] p-4 text-white no-underline">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15"><MessageCircle className="h-6 w-6" /></span>
        <span><span className="block text-lg font-extrabold">Escribir por WhatsApp</span><span className="block text-sm text-white/80">{SUPPORT_PHONE}</span></span>
      </a>
      <section><h2>Cuándo escribirnos</h2>
        <ul><li>No puedes entrar a tu cuenta o a tu negocio.</li><li>Tienes una duda sobre tu suscripción, un cobro o un complemento.</li><li>Quieres importar tus clientes desde otra aplicación.</li><li>Quieres ver, corregir o borrar tus datos (mira la <Link className="underline" href="/privacidad">política de privacidad</Link>).</li></ul></section>
      <section><h2>Para ayudarte más rápido</h2>
        <p>Dinos el nombre de tu negocio, el correo con el que entras y qué pasó. Si puedes, manda una captura de pantalla.</p></section>
      <section><h2>Tu suscripción</h2>
        <p>Si eres el dueño, puedes cambiar el plan, activar o quitar complementos y ver tus facturas en <strong>Ajustes → Suscripción</strong>.</p></section>
    </LegalPage>
  );
}
