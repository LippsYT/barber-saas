# Pulso — barbería SaaS

Next.js 16 (App Router) + TypeScript + Tailwind + Supabase (Postgres + Auth + RLS). Interfaz en español, mobile-first, montos en dólares (centavos enteros).

## Pantallas
- `/` landing (Inicio, Reservas, Caja, Clientes, WhatsApp, precios, preguntas)
- `/login` · `/onboarding` (colaboradores → servicios → datos y portada → WhatsApp → link para compartir)
- `/app` inicio del mes · `/app/agenda` semana con bloques por barbero · `/app/cobro` · `/app/caja` (saldo, ver detalles y ver cálculo) · `/app/clientes` (botón WhatsApp) · `/app/servicios` (comisión por barbero) · `/app/equipo` · `/app/libro` · `/app/reportes` · `/app/whatsapp`
- Público: `/{barberia}` (fecha → barbero → servicio → horario → datos), `/{barberia}/{barbero}`, `/{barberia}/cita/{token}`
- Los links viejos `/b/...` redirigen de forma permanente a la URL corta.

## Setup
1. `npm install`
2. Crear un proyecto Supabase y aplicar en orden `supabase/migrations/*.sql` (SQL editor o `supabase db push`). **No asumas que ya están aplicadas.**
3. Demo genérica: `supabase/seed.sql` (reemplazar `__DEMO_PASSWORD__`; slug `demo`).
4. House Davidson (catálogo real de la fuente, slug `house-davidson`) entra con la migración `0009` y las categorías/tipos de precio con `0010`.
5. Variables de entorno (`.env.local` y en el hosting):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `EVOLUTION_API_URL` y `EVOLUTION_API_KEY` (opcionales; ver WhatsApp)
6. `npm run dev` · `npm run build` · `npx tsc --noEmit` · `npx vitest run`

## Migraciones nuevas en este cambio
- `supabase/migrations/0010_catalog_cover_whatsapp.sql` — categoría y `price_kind` de servicios, portada (`cover_url`), tabla `whatsapp_links` con RLS, catálogo público ampliado, slug `captura` reservado, moneda por defecto USD en `create_business`, y bucket `covers` **solo si** existe el esquema `storage`.

`0008` y `0009` ya venían en la rama (USD, links cortos, seed House Davidson). `0009` quedó alineado a la fuente: bloques de 10 minutos, sin teléfono inventado.

## WhatsApp (código de emparejamiento, no la API de Meta)
Hay una capa `src/lib/whatsapp`:
- `EvolutionApiProvider` si existen `EVOLUTION_API_URL` y `EVOLUTION_API_KEY`. Llama Evolution API **v2**: `POST /instance/create`, `GET /instance/connect/{instancia}?number=`, `GET /instance/connectionState/{instancia}`.
- `MockProvider` si faltan esas variables. La pantalla dice **modo demo**. El código de 8 caracteres no vincula un teléfono real; el botón «Ya introduje el código» solo marca la fila en `whatsapp_links`.

La clave no sale al navegador: la usa la ruta `POST /api/whatsapp`.

### Infra que falta para que WhatsApp sea real
- Un servidor **Evolution API v2** (Baileys) accesible desde el hosting, con `EVOLUTION_API_URL` y `EVOLUTION_API_KEY`.
- El número de la barbería tiene que poder «vincular con número de teléfono» en WhatsApp. Eso no es la API oficial de Meta (Cloud API) ni requiere plantillas de Meta.
- Los recordatorios siguen en `scheduled_messages`. **No hay worker** que los envíe por Evolution. Conectar el número no dispara esos mensajes todavía.
- No hay webhooks de mensajes entrantes ni un asistente de voz. La landing lo cuenta como dirección del producto; el código de vinculación es lo que está implementado.

## Portadas
Si Supabase Storage existe, `0010` crea el bucket público `covers` y políticas para que el dueño o un admin suban a una carpeta con el id del negocio. En los tests (PGlite) no hay `storage` y esa parte se omite. Si la subida falla, el onboarding deja pegar una URL.

## Tests
`npx vitest run` — comisiones (incluida la regla barbero+servicio), caja, ledger, slots, el catálogo exacto de House Davidson contra `0009`/`0010`, el parser de Evolution, y la base con PGlite (RLS y RPC).

## Finanzas
- `ledger_entries` es append-only. Una corrección es un asiento inverso (`reversal_of`).
- Cada total de caja tiene «ver cálculo».
- La comisión de un servicio por barbero se guarda en `commission_rules` (`member_id` + `item_id`). Esa regla gana sobre la del negocio. El cobro sigue guardando el snapshot.
