"use client";
import { WhatsAppConnect } from "@/components/app/WhatsAppConnect";
import { ReactivationSettings } from "@/components/app/ReactivationSettings";
import { LockedAddon } from "@/components/app/LockedAddon";
import { useApp } from "@/components/ctx";

export default function WhatsAppPage() {
  const { has } = useApp();
  return (
    <main className="space-y-4">
      <div className="eyebrow">WhatsApp</div>
      <WhatsAppConnect />
      {has("marketing") ? <ReactivationSettings /> : <LockedAddon addon="marketing" />}
      <p className="text-xs text-ink/45">Pulso no usa la API oficial de Meta. Con Evolution API (variables de entorno) el código vincula el número. Sin esas variables entras en modo demo.</p>
    </main>
  );
}
