-- Suscripción mensual de cada barbería a Pulso (Stripe). Una fila por negocio.
-- Solo el servidor (webhook de Stripe) la escribe, con RPC protegidas por el mismo secreto del worker (_cron_ok).
create table if not exists subscriptions (
  business_id uuid primary key references businesses(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'none',
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table subscriptions enable row level security;
drop policy if exists subscriptions_sel on subscriptions;
create policy subscriptions_sel on subscriptions for select to authenticated using (has_role(business_id, 'owner', 'admin'));
revoke all on subscriptions from public, anon, authenticated;
grant select on subscriptions to authenticated;

-- Guarda el cliente de Stripe de un negocio (lo llama el servidor al abrir el primer cobro).
create or replace function public.billing_link_customer(p_secret text, p_business uuid, p_customer text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not _cron_ok(p_secret) then raise exception 'forbidden'; end if;
  insert into subscriptions(business_id, stripe_customer_id) values (p_business, p_customer)
  on conflict (business_id) do update set stripe_customer_id = excluded.stripe_customer_id, updated_at = now();
end $$;

-- Sincroniza el estado que manda el webhook. Devuelve false si el cliente no es de ningún negocio.
create or replace function public.billing_sync(p_secret text, p_customer text, p_subscription text, p_status text,
  p_period_end timestamptz, p_trial_end timestamptz, p_cancel boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not _cron_ok(p_secret) then raise exception 'forbidden'; end if;
  update subscriptions set stripe_subscription_id = p_subscription, status = p_status, current_period_end = p_period_end,
    trial_end = p_trial_end, cancel_at_period_end = coalesce(p_cancel, false), updated_at = now()
  where stripe_customer_id = p_customer;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.billing_link_customer(text, uuid, text), public.billing_sync(text, text, text, text, timestamptz, timestamptz, boolean) from public;
grant execute on function public.billing_link_customer(text, uuid, text), public.billing_sync(text, text, text, text, timestamptz, timestamptz, boolean) to anon, authenticated;
