-- Paso de Stripe en modo prueba a modo real (live).
-- Los ids de cliente y suscripción guardados hasta hoy son de modo prueba: en live no existen y rompen el portal y el cobro.
-- Se limpian los datos de Stripe de la suscripción; el negocio, las citas y la caja no se tocan.
-- El estado queda en 'none': el acceso lo decide entonces la prueba de 14 días del negocio (businesses.trial_ends_at) o el pago live.
-- Aplicar UNA sola vez, antes de que alguien se suscriba en modo real (una suscripción live también se limpiaría).
-- Antes de aplicar, corre supabase/maintenance/0033_preview.sql para ver cuántas filas afecta.
do $$
declare n int;
begin
  update subscriptions
     set stripe_customer_id = null, stripe_subscription_id = null, status = 'none',
         current_period_end = null, trial_end = null, cancel_at_period_end = false, addons = '{}', updated_at = now()
   where stripe_customer_id is not null or stripe_subscription_id is not null or status <> 'none';
  get diagnostics n = row_count;
  raise notice 'Suscripciones de prueba limpiadas: %', n;
end $$;
