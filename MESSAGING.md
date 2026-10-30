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
`cron_target_url` (alias git-preview), `app_base_url`.

## Seguridad
- `WHATSAPP_SEND_ALLOWLIST` (E.164, coma). Con lista: el resto queda `skipped`. Sin lista: producción envía a todos;
  preview/local no envía a nadie. Igual `EMAIL_SEND_ALLOWLIST` para email.
- `WHATSAPP_FALLBACK_INSTANCE` (solo fuera de producción): instancia a usar si el negocio no tiene WhatsApp conectado.

## Env
`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `CRON_SECRET`, `WHATSAPP_SEND_ALLOWLIST`, `WHATSAPP_FALLBACK_INSTANCE`,
`RESEND_API_KEY` (opcional; sin ella email = mock), `EMAIL_FROM`, `EMAIL_SEND_ALLOWLIST`,
`GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_KEY` (opcional; sin ellas no se muestra el botón de Wallet).
