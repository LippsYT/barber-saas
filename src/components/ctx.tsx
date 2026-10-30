"use client";
import { createContext, useContext } from "react";
export type Role = "owner" | "admin" | "receptionist" | "barber";
export interface Biz { id: string; name: string; slug: string; timezone: string; currency: string }
export interface Ctx { biz: Biz; role: Role; memberId: string; userId: string; isManager: boolean; canCash: boolean }
export const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(AppCtx); if (!c) throw new Error("sin contexto"); return c; };
