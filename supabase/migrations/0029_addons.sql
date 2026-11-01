-- Complementos de la suscripción: el plan base cubre agenda, reservas, caja y equipo; el resto se agrega por separado.
-- Claves de complemento: whatsapp (mensajes automáticos por WhatsApp), marketing (reactivación de clientes),
-- informes (PDF de caja e informe semanal por email), inventario (productos y proveedores).
-- Tiene todo: negocio exento, o en prueba sin suscripción de pago. Con suscripción: solo lo que tenga contratado.
alter table subscriptions add column if not exists addons text[] not null default '{}';

create or replace function public._biz_all(p_bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select b.billing_exempt
                          or (b.trial_ends_at > now() and coalesce(s.status, 'none') not in ('active', 'trialing', 'past_due'))
                   from businesses b left join subscriptions s on s.business_id = b.id where b.id = p_bid), false)
$$;
revoke all on function public._biz_all(uuid) from public, anon, authenticated;

create or replace function public._biz_has(p_bid uuid, p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select _biz_all(p_bid) or coalesce((select s.status in ('active', 'trialing', 'past_due') and p_key = any(s.addons)
                                      from subscriptions s where s.business_id = p_bid), false)
$$;
revoke all on function public._biz_has(uuid, text) from public, anon, authenticated;

-- El webhook de Stripe ahora también manda la lista de complementos que tiene la suscripción (null = no tocarla).
drop function if exists public.billing_sync(text, text, text, text, timestamptz, timestamptz, boolean);
create or replace function public.billing_sync(p_secret text, p_customer text, p_subscription text, p_status text,
  p_period_end timestamptz, p_trial_end timestamptz, p_cancel boolean, p_addons text[] default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not _cron_ok(p_secret) then raise exception 'forbidden'; end if;
  update subscriptions set stripe_subscription_id = p_subscription, status = p_status, current_period_end = p_period_end,
    trial_end = p_trial_end, cancel_at_period_end = coalesce(p_cancel, false), addons = coalesce(p_addons, addons), updated_at = now()
  where stripe_customer_id = p_customer;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.billing_sync(text, text, text, text, timestamptz, timestamptz, boolean, text[]) from public;
grant execute on function public.billing_sync(text, text, text, text, timestamptz, timestamptz, boolean, text[]) to anon, authenticated;

-- Estado de acceso del negocio del usuario, con sus complementos (lo lee el layout de la app).
create or replace function public.my_billing() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare bid uuid; b businesses; s subscriptions;
begin
  select m.business_id into bid from memberships m where m.user_id = auth.uid() and m.active limit 1;
  if bid is null then return null; end if;
  select * into b from businesses where id = bid;
  select * into s from subscriptions where business_id = bid;
  return jsonb_build_object('active', _biz_active(bid), 'exempt', b.billing_exempt, 'trial_ends_at', b.trial_ends_at,
                            'status', coalesce(s.status, 'none'), 'period_end', s.current_period_end,
                            'all', _biz_all(bid), 'addons', to_jsonb(coalesce(s.addons, '{}'::text[])));
end $$;
revoke all on function public.my_billing() from public, anon;
grant execute on function public.my_billing() to authenticated;

-- Los mensajes automáticos por WhatsApp (confirmación, recordatorios, cancelación y reseña) son del complemento "whatsapp".
create or replace function public._msg_on(p_bid uuid, p_key text, p_default boolean default true) returns boolean
language sql stable security definer set search_path = public as $$
  select _biz_has(p_bid, 'whatsapp') and coalesce((select (settings->'messages'->>p_key)::boolean from businesses where id = p_bid), p_default)
$$;
revoke all on function public._msg_on(uuid, text, boolean) from public, anon, authenticated;

-- La reactivación de clientes es del complemento "marketing". Resto igual que 0015.
create or replace function public.enqueue_reactivations() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record; d int;
begin
  for r in
    select c as cl, b as bz, coalesce((b.settings->'reactivation'->>'days')::int, 25) as days, lv.last_visit
    from businesses b
    join clients c on c.business_id = b.id
    join lateral (select max(a.starts_at) last_visit from appointments a where a.client_id = c.id and a.status = 'completed') lv on true
    where coalesce((b.settings->'reactivation'->>'enabled')::boolean, false)
      and _biz_has(b.id, 'marketing') and _biz_has(b.id, 'whatsapp')
      and c.whatsapp_opt_in and c.phone is not null and lv.last_visit is not null
  loop
    d := r.days;
    if r.last_visit > now() - make_interval(days => d) then continue; end if;
    if exists (select 1 from appointments a where a.client_id = (r.cl).id and a.starts_at > now() and a.status in ('reserved','confirmed')) then continue; end if;
    if exists (select 1 from scheduled_messages s where s.client_id = (r.cl).id and s.kind = 'reactivation'
               and s.status in ('pending','sending','sent') and s.created_at > now() - make_interval(days => d)) then continue; end if;
    insert into scheduled_messages(business_id, client_id, kind, to_phone, payload, send_at)
      values ((r.bz).id, (r.cl).id, 'reactivation', (r.cl).phone,
              jsonb_build_object('body', _reactivation_body(r.cl, r.bz, greatest(d, (extract(epoch from now() - r.last_visit) / 86400)::int))), now());
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.enqueue_reactivations() from public, anon, authenticated;

-- El informe semanal por email es del complemento "informes". Resto igual que 0027.
create or replace function public.report_targets(p_secret text)
returns table(business_id uuid, name text, timezone text, currency text, owner_email text)
language plpgsql security definer set search_path = public as $$
begin
  if not _cron_ok(p_secret) then raise exception 'forbidden'; end if;
  return query
    select b.id, b.name, b.timezone, b.currency, u.email::text
    from businesses b
    join memberships m on m.business_id = b.id and m.role = 'owner' and m.active
    join auth.users u on u.id = m.user_id
    where coalesce((b.settings->>'weekly_report')::boolean, false) and u.email is not null and _biz_has(b.id, 'informes');
end $$;
revoke all on function public.report_targets(text) from public;
grant execute on function public.report_targets(text) to anon, authenticated;
