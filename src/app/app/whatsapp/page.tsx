"use client";
import { WhatsAppConnect } from "@/components/app/WhatsAppConnect";
import { ReactivationSettings } from "@/components/app/ReactivationSettings";

export default function WhatsAppPage() {
  return (
    <main className="space-y-4">
      <div className="eyebrow">WhatsApp</div>
      <WhatsAppConnect />
      <ReactivationSettings />
      <p className="text-xs text-ink/45">Pulso no usa la API oficial de Meta. Con Evolution API (variables de entorno) el código vincula el número. Sin esas variables entras en modo demo.</p>
    </main>
  );
}
