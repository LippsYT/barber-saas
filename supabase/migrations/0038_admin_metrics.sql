-- Métricas para el panel del dueño de Pulso: registros, pruebas, suscritos, ingresos y un feed de eventos (registro y pago).
-- Los pagos se guardan cuando Stripe avisa `invoice.paid`; sin ese aviso solo se conocen estados, no montos.

create table if not exists billing_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete set null,
  stripe_invoice_id text not null unique,
  amount bigint not null check (amount >= 0),     -- centavos de la moneda de cobro
  currency text not null,                          -- 'usd', 'ars', 'brl', 'eur'
  paid_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists billing_payments_paid_at on billing_payments(paid_at desc);
alter table billing_payments enable row level security;
revoke all on billing_payments from public, anon, authenticated;

-- Dominio 'billing' (el mismo del webhook). Devuelve true si el pago era nuevo.
create or replace function public.billing_record_payment(p_secret text, p_customer text, p_invoice text, p_amount bigint, p_currency text, p_paid_at timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not _cron_ok(p_secret, 'billing') then raise exception 'forbidden'; end if;
  insert into billing_payments(business_id, stripe_invoice_id, amount, currency, paid_at)
  values ((select s.business_id from subscriptions s where s.stripe_customer_id = p_customer), p_invoice, p_amount, lower(p_currency), coalesce(p_paid_at, now()))
  on conflict (stripe_invoice_id) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.billing_record_payment(text, text, text, bigint, text, timestamptz) from public;
grant execute on function public.billing_record_payment(text, text, text, bigint, text, timestamptz) to anon, authenticated;

-- Dominio 'metrics'. Los negocios exentos de cobro (demos, el tuyo) no cuentan.
create or replace function public.admin_metrics(p_secret text, p_since timestamptz default now() - interval '7 days')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not _cron_ok(p_secret, 'metrics') then raise exception 'forbidden'; end if;
  with real as (select b.id, b.name, b.country, b.currency, b.created_at, b.trial_ends_at from businesses b where not b.billing_exempt),
       subs as (select s.status, s.addons, s.business_id, r.currency from subscriptions s join real r on r.id = s.business_id),
       paying as (select business_id from subs where status in ('active', 'trialing', 'past_due'))
  select jsonb_build_object(
    'signups', jsonb_build_object(
      'total', (select count(*) from real),
      'last_7d', (select count(*) from real where created_at > now() - interval '7 days'),
      'last_30d', (select count(*) from real where created_at > now() - interval '30 days')),
    'trial', jsonb_build_object(
      'active', (select count(*) from real x where x.trial_ends_at > now() and x.id not in (select business_id from paying)),
      'expired', (select count(*) from real x where x.trial_ends_at <= now() and x.id not in (select business_id from paying))),
    'subscribed', jsonb_build_object(
      'active', (select count(*) from subs where status in ('active', 'trialing')),
      'past_due', (select count(*) from subs where status = 'past_due'),
      'canceled', (select count(*) from subs where status in ('canceled', 'unpaid', 'incomplete_expired'))),
    'active_subs', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'addons', to_jsonb(addons))), '[]'::jsonb) from subs where status in ('active', 'trialing', 'past_due')),
    'revenue', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'total', total, 'month', month, 'payments', n)), '[]'::jsonb)
                from (select currency, sum(amount) as total, coalesce(sum(amount) filter (where paid_at >= date_trunc('month', now())), 0) as month, count(*) as n from billing_payments group by currency) x),
    'events', (select coalesce(jsonb_agg(e order by e->>'at' desc), '[]'::jsonb) from (
      select jsonb_build_object('id', 'signup:' || id, 'type', 'signup', 'at', created_at, 'business', name, 'country', country) e from real where created_at >= p_since
      union all
      select jsonb_build_object('id', 'payment:' || p.stripe_invoice_id, 'type', 'payment', 'at', p.paid_at, 'business', (select b.name from businesses b where b.id = p.business_id), 'amount', p.amount, 'currency', p.currency)
        from billing_payments p where p.paid_at >= p_since) q)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_metrics(text, timestamptz) from public;
grant execute on function public.admin_metrics(text, timestamptz) to anon, authenticated;
