-- Vista previa de la migración 0033: solo lee, no cambia nada. Corre en el SQL editor de Supabase.
-- No muestra ids de Stripe, solo conteos.
select
  count(*)                                                     as filas_en_subscriptions,
  count(*) filter (where stripe_customer_id is not null or stripe_subscription_id is not null or status <> 'none') as filas_que_limpiaria_0033,
  count(stripe_customer_id)                                    as con_customer_id,
  count(stripe_subscription_id)                                as con_subscription_id
from public.subscriptions;

-- Por estado, y cuántos de esos negocios tienen la prueba de 14 días ya vencida (verían el bloqueo de pago al limpiar).
select s.status,
       count(*)                                                                as filas,
       count(*) filter (where b.trial_ends_at <= now() and not b.billing_exempt) as con_prueba_vencida_y_no_exentos
from public.subscriptions s join public.businesses b on b.id = s.business_id
where s.stripe_customer_id is not null or s.stripe_subscription_id is not null or s.status <> 'none'
group by s.status order by s.status;
