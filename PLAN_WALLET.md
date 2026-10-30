# Plan Wallet (Google + Apple) — investigado 30/10/2026

## Google Wallet (ya implementado en src/lib/gwallet.ts; se activa con env)
Fuente: https://developers.google.com/wallet/generic/web/prerequisites (consultada hoy)
1. El dueño entra a https://pay.google.com/business/console con su cuenta Google → "Google Wallet API" → crea la cuenta de emisor (nombre del negocio, aceptar términos). Gratis; no hay cuota de emisión.
2. Google Cloud Console: crear proyecto → habilitar "Google Wallet API" → crear cuenta de servicio → clave JSON.
3. En la Business Console: Usuarios → invitar el email de la cuenta de servicio como Desarrollador.
4. Crear al menos 1 clase (genérica/evento) en la Business Console.
5. Envs en Vercel (preview): GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SA_EMAIL, GOOGLE_WALLET_SA_KEY → aparece "Agregar a Google Wallet".
6. Modo demo: solo admins/desarrolladores/usuarios de prueba pueden guardar pases. Para clientes reales: "Solicitar acceso de publicación" en la consola (revisión de Google).
Costo/tarjeta: la API de Wallet no tiene cobro; la cuenta de emisor no pide tarjeta. Crear proyecto GCP + cuenta de servicio no requiere facturación (no lo verifiqué creando cuenta: prohibido registrarse).

## Apple Wallet
Firmar .pkpass propio exige Apple Developer Program (US$99/año) → descartado (sin gastos).
| Servicio | Gratis | Tarjeta | API | ¿Sin cuenta Apple? |
|---|---|---|---|---|
| WalletWallet (walletwallet.dev/docs, /pricing) | 1.000 pases/mes | No | Sí, POST /api/passes (Apple + Google en 1 llamada) | **Sí**: firma con su certificado (el propio es Pro, $39/mes) |
| PassSlot | 1.000 pases guardados, 1 tipo | No | Sí | No: requiere certificado Apple propio |
| Pass2U | 50 créditos (3/pase ≈ 16 pases) | — | Limitada | Sí, pero no escala |
| Passcreator (app.passcreator.com/en/register) | 5 registros activos, con API | — | Sí | No: "Apple requires every company… its own certificate" |

**Viable: WalletWallet Free.** Límites: sin color/logo propio (preset "blue"), marca WalletWallet en la emisión, 1 pase por cita (POST cuenta cada vez que se pulsa el botón).

### Implementado (gated por env)
- src/lib/applePass.ts + /api/cita/[token]/pkpass: genera el pase por cita (fecha/hora local, servicio, barbero, QR al link de la cita, dirección y link en el reverso, vence 24 h después) y devuelve application/vnd.apple.pkpass.
- Botón "Agregar a Apple Wallet" en la página de la cita solo si WALLETWALLET_API_KEY está definida. Sin env → 404 y botón oculto.
- Tests: src/lib/applePass.test.ts (mock de fetch; no se llamó a la API real).
- Para activar: el dueño crea cuenta gratis en walletwallet.dev (sin tarjeta), copia la key ww_live_… a Vercel preview como WALLETWALLET_API_KEY.
- Mejora futura: guardar serialNumber por cita para no gastar cuota en reintentos y revocar (DELETE) al cancelar.
