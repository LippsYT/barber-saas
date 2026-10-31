# Mensajes automáticos (WhatsApp por Evolution + email)

Cola: `scheduled_messages` (status pending → sending → sent | failed | skipped | cancelled).

| Tipo | Cuándo se encola | Envío |
|---|---|---|
| confirmation | al reservar por link público (opt-in) | inmediato: `/api/messages/kick` tras `public_create_booking` |
| reminder | 24 h y 2 h antes | cron |
| cancellation | trigger al pasar la cita a `cancelled` (cliente o negocio) | inmediato (kick) + cron |
| reactivation | job diario `enqueue_reactivations()` (pg_cron 13:00 UTC) si `settings.reactivation.enabled` (default OFF, 25 días) · botón «Enviar recordatorio de regreso» en el cliente | inmediato |

Worker: `/api/cron/send-messages` (Bearer `CRON_SECRET`). Usa RPC `msg_claim` (FOR UPDATE SKIP LOCKED) y
`msg_finish` (backoff 2^n min, máx. 3 intentos). Las RPC validan el secreto contra Supabase Vault (`cron_secret`),
así Vercel no necesita la service_role key. Envía desde la instancia `whatsapp_links` del negocio (status connected).

Programación: pg_cron `send-messages` cada 3 min llama `_kick_sender()` → pg_net POST al worker con
`Authorization: Bearer <cron_secret>` y `x-vercel-protection-bypass: <vercel_bypass>` (Protection Bypass for Automation,
disponible en plan gratis). Solo hace la llamada si hay mensajes vencidos. Vault: `cron_secret`, `vercel_bypass`,
`cron_target_url` (el worker; puede ser el alias de preview), `app_base_url`.

## URL de los links
Los cuerpos guardan el marcador `{{BASE}}`. Al enviar, el worker lo reemplaza con `APP_BASE_URL`
(sin barra final). Si esa variable falta, o si apunta a un host `barber-saas-*.vercel.app` que no es el alias
de producción, se usa `https://barber-saas-chi-five.vercel.app`. El sender no lee `VERCEL_URL`,
`VERCEL_BRANCH_URL` ni `VERCEL_PROJECT_PRODUCTION_URL`. Lo mismo vale para confirmación, recordatorios,
cancelación, reactivación (job y botón) y para el link que queda dentro del .ics / Wallet.

`0020_canonical_base_url.sql` (archivo nuevo, **no aplicado**) reescribe hosts de preview ya guardados en
mensajes `pending`/`sending` y hace que `_app_base_url()` ignore esos hosts si el vault todavía los tiene.

## Seguridad
- `WHATSAPP_SEND_ALLOWLIST` (E.164, coma). Con lista: el resto queda `skipped`. Sin lista: producción envía a todos;
  preview/local no envía a nadie. Igual `EMAIL_SEND_ALLOWLIST` para email.
- `WHATSAPP_FALLBACK_INSTANCE` (solo fuera de producción): instancia a usar si el negocio no tiene WhatsApp conectado.

## Env
`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `CRON_SECRET`, `WHATSAPP_SEND_ALLOWLIST`, `WHATSAPP_FALLBACK_INSTANCE`,
`BREVO_API_KEY` (opcional, prioridad; API v3 `POST /v3/smtp/email`, sender desde `EMAIL_FROM` "Nombre <email>" o email; requiere EMAIL_FROM), `RESEND_API_KEY` (fallback; sin ninguna, email = mock), `EMAIL_FROM`, `EMAIL_SEND_ALLOWLIST`,
`GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_KEY` (opcional; sin ellas no se muestra el botón de Wallet).

## Deduplicación de cola (migración 0018)
Índices únicos parciales en `scheduled_messages` (solo filas `pending/sending/sent` con `appointment_id`):
confirmación/cancelación = 1 por (cita, canal, kind); recordatorio = 1 por (cita, canal, send_at) → 24h y 2h conviven.
Reactivación/custom no tienen cita y quedan fuera. Los inserts de `public_create_booking`, `schedule_reminders`
y `appointments_msg_sync` usan `ON CONFLICT DO NOTHING`.
