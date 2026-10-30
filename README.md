# Barbería SaaS (MVP)

Next.js 16 (App Router) + TypeScript + Tailwind + Supabase (Postgres + Auth + RLS). Interfaz en español, mobile-first.

## Pantallas
- `/` inicio · `/login` (registro/ingreso) · `/onboarding` (crear barbería)
- `/app` agenda del día · `/app/cobro` cobrar (pagos divididos, propina, descuento, "ver cálculo" de comisión)
- `/app/libro` libro de caja (día/semana/mes, saldos por cuenta con "ver cálculo", anular venta = asiento inverso)
- `/app/caja` apertura, gastos, cierre con conteo de billetes y diferencia
- `/app/reportes` por empleado (el barbero ve solo lo suyo) · `/app/servicios` · `/app/equipo` · `/app/clientes`
- Público: `/b/{barberia}` (fecha → barbero → servicio → horario), `/b/{barberia}/{barbero}`, `/b/{barberia}/cita/{token}` (ver/cancelar)

## Setup
1. `npm install`
2. Crear un proyecto Supabase y aplicar en orden `supabase/migrations/*.sql` (SQL editor o `supabase db push`).
3. Opcional: `supabase/seed.sql` / script de demo.
4. Variables de entorno (`.env.local` y en Vercel):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. `npm run dev` · `npm run build`

## Tests
`npx vitest run` — unit (ledger, caja, comisiones, tiempo) + tests de base de datos con PGlite (migraciones reales, RLS, RPCs de finanzas y reservas).

## Principios de finanzas
- `ledger_entries` es append-only (triggers bloquean UPDATE/DELETE); toda corrección es un asiento inverso (`reversal_of`).
- Cada total en pantalla tiene "ver cálculo" que lista los asientos que lo componen.
- Comisiones guardan un snapshot de la regla usada.
