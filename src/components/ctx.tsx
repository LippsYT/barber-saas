"use client";
import { createContext, useContext } from "react";
import type { AddonKey } from "@/lib/addons";
export type Role = "owner" | "admin" | "receptionist" | "barber";
export interface Biz { id: string; name: string; slug: string; timezone: string; currency: string }
export interface Ctx {
  biz: Biz; role: Role; memberId: string; userId: string; isManager: boolean; canCash: boolean;
  /** ¿El negocio tiene este complemento de la suscripción? (en prueba o exento: todos) */
  has: (key: AddonKey) => boolean;
}
export const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(AppCtx); if (!c) throw new Error("sin contexto"); return c; };
