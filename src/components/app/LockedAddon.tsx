"use client";
import Link from "next/link";
import { Lock, Check } from "lucide-react";
import { formatUsd } from "@/lib/money";
import { addonOf, type AddonKey } from "@/lib/addons";

/** Tarjeta que reemplaza una función de un complemento que el negocio todavía no tiene. */
export function LockedAddon({ addon, compact = false }: { addon: AddonKey; compact?: boolean }) {
  const a = addonOf(addon)!;
  return (
    <section className={`rounded-[1.7rem] bg-ink text-white ${compact ? "p-4" : "p-6"}`}>
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#D6FF4A] text-ink"><Lock className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#D6FF4A]">Complemento</div>
          <h2 className="font-display text-2xl font-extrabold uppercase leading-none">{a.name}</h2>
        </div>
      </div>
      <p className="mt-3 text-sm text-white/75">{a.summary}</p>
      {!compact && <ul className="mt-3 space-y-1.5 text-sm">{a.features.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#D6FF4A]" />{f}</li>)}</ul>}
      <Link href="/app/suscripcion" className="btn-gold mt-4 block w-full text-center">Agregar por {formatUsd(a.price)} al mes</Link>
    </section>
  );
}
