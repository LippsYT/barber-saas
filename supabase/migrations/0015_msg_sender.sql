-- 0015: envío real de WhatsApp. El worker es /api/cron/send-messages (Next) y usa estas RPC.
-- Las RPC del worker exigen p_secret = vault 'cron_secret' (no hace falta service_role en Vercel).
alter table scheduled_messages add column if not exists sent_at timestamptz;
alter table scheduled_messages add column if not exists claimed_at timestamptz;

create or replace function public._cron_ok(p_secret text) returns boolean
language sql stable security definer set search_path = public, vault as $$
  select p_secret is not null and length(p_secret) >= 32 and exists (
    select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret = p_secret)
$$;
revoke all on function public._cron_ok(text) from public, anon, authenticated;

create or replace function public._app_base_url() returns text
language sql stable security definer set search_path = public, vault as $$
  select coalesce((select rtrim(decrypted_secret, '/') from vault.decrypted_secrets where name = 'app_base_url'), '')
$$;
revoke all on function public._app_base_url() from public, anon, authenticated;

-- Toma mensajes vencidos (FOR UPDATE SKIP LOCKED) y los pasa a 'sending'.
-- Filtros opcionales: una cita (envío inmediato) o un mensaje.
create or replace function public.msg_claim(p_secret text, p_limit int default 20, p_appointment uuid default null, p_id uuid default null)
returns table(id uuid, business_id uuid, kind text, to_phone text, body text, attempts int, instance_name text)
language plpgsql security definer set search_path = public as $$
begin
  if not _cron_ok(p_secret) then raise exception 'forbidden'; end if;
  -- recupera 'sending' colgados (>10 min)
  update scheduled_messages s set status = 'pending' where s.status = 'sending' and s.claimed_at < now() - interval '10 minutes';
  return query
  with c as (
    select s.id from scheduled_messages s
    where s.status = 'pending' and s.send_at <= now() and s.channel = 'whatsapp'
      and (p_appointment is null or s.appointment_id = p_appointment)
      and (p_id is null or s.id = p_id)
    order by s.send_at
    for update skip locked
    limit greatest(1, least(p_limit, 100))
  ), u as (
    update scheduled_messages s set status = 'sending', attempts = s.attempts + 1, claimed_at = now()
    from c where s.id = c.id
    returning s.id, s.business_id, s.kind, s.to_phone, s.payload->>'body' as body, s.attempts
  )
  select u.id, u.business_id, u.kind, u.to_phone, u.body, u.attempts,
         (select w.instance_name from whatsapp_links w where w.business_id = u.business_id and w.status = 'connected' and not w.demo)
  from u;
end $$;

-- Cierra un mensaje: sent | skipped | failed (failed con attempts<3 vuelve a pending con backoff 2^n min).
create or replace function public.msg_finish(p_secret text, p_id uuid, p_status text, p_provider_id text default null, p_error text default null)
returns text language plpgsql security definer set search_path = public as $$
declare a int; st text;
begin
  if not _cron_ok(p_secret) then raise exception 'forbidden'; end if;
  select attempts into a from scheduled_messages where id = p_id;
  if p_status = 'sent' then
    update scheduled_messages set status = 'sent', provider_msg_id = p_provider_id, sent_at = now(), error = null where id = p_id; st := 'sent';
  elsif p_status = 'skipped' then
    update scheduled_messages set status = 'skipped', error = left(p_error, 300) where id = p_id; st := 'skipped';
  elsif coalesce(a, 3) < 3 then
    update scheduled_messages set status = 'pending', error = left(p_error, 300),
      send_at = now() + make_interval(mins => power(2, a)::int) where id = p_id; st := 'retry';
  else
    update scheduled_messages set status = 'failed', error = left(p_error, 300) where id = p_id; st := 'failed';
  end if;
  return st;
end $$;
grant execute on function public.msg_claim(text, int, uuid, uuid), public.msg_finish(text, uuid, text, text, text) to anon, authenticated;

-- Aviso de cancelación + reprogramación de recordatorios.
create or replace function public.appointments_msg_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare c clients; b businesses;
begin
  if new.status in ('cancelled','no_show','completed') or new.starts_at <> old.starts_at then
    update scheduled_messages set status = 'cancelled'
      where appointment_id = new.id and status = 'pending' and kind in ('reminder','confirmation');
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.client_id is not null then
    select * into c from clients where id = new.client_id;
    select * into b from businesses where id = new.business_id;
    if c.whatsapp_opt_in and c.phone is not null then
      insert into scheduled_messages(business_id, client_id, appointment_id, kind, to_phone, payload, send_at)
      values (new.business_id, c.id, new.id, 'cancellation', c.phone, jsonb_build_object('body',
        format('Hola %s, tu cita en %s del %s fue cancelada. Si quieres, reserva otra: %s', c.full_name, b.name,
          to_char(new.starts_at at time zone b.timezone, 'DD/MM "a las" HH24:MI'),
          case when _app_base_url() <> '' then _app_base_url() || '/' || b.slug else '/' || b.slug end)), now());
    end if;
  end if;
  if new.starts_at <> old.starts_at and new.status not in ('cancelled','no_show','completed') then
    perform public.schedule_reminders(new.id);
  end if;
  return null;
end $$;

-- ===== Reactivación =====
-- settings.reactivation = {"enabled": bool (default false), "days": int (default 25)}
create or replace function public._reactivation_body(c clients, b businesses, p_days int) returns text
language sql stable security definer set search_path = public as $$
  select format('Hola %s, ya pasaron %s días desde tu último corte en %s. ¿Agendamos el próximo? Reservá acá: %s',
    c.full_name, p_days, b.name,
    case when _app_base_url() <> '' then _app_base_url() || '/' || b.slug else '/' || b.slug end)
$$;

-- Job diario (pg_cron): encola reactivaciones vencidas.
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

-- Botón manual (dueño/admin del negocio del cliente). Devuelve el id del mensaje.
create or replace function public.enqueue_reactivation_now(p_client uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare c clients; b businesses; lv timestamptz; d int; mid uuid;
begin
  select * into c from clients where id = p_client;
  if not found then raise exception 'not_found'; end if;
  if not exists (select 1 from memberships m where m.business_id = c.business_id and m.user_id = auth.uid()
                 and m.active and m.role in ('owner','admin')) then raise exception 'forbidden'; end if;
  if c.phone is null then raise exception 'no_phone'; end if;
  select * into b from businesses where id = c.business_id;
  select max(starts_at) into lv from appointments where client_id = c.id and status = 'completed';
  d := coalesce((extract(epoch from now() - lv) / 86400)::int, coalesce((b.settings->'reactivation'->>'days')::int, 25));
  insert into scheduled_messages(business_id, client_id, kind, to_phone, payload, send_at, created_by)
    values (b.id, c.id, 'reactivation', c.phone, jsonb_build_object('body', _reactivation_body(c, b, d)), now(), auth.uid())
    returning id into mid;
  return mid;
end $$;
revoke all on function public.enqueue_reactivation_now(uuid) from public, anon;
grant execute on function public.enqueue_reactivation_now(uuid) to authenticated;

-- Ajustes de reactivación (dueño/admin).
create or replace function public.set_reactivation_settings(p_enabled boolean, p_days int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare bid uuid; s jsonb;
begin
  if p_days is null or p_days < 7 or p_days > 365 then raise exception 'bad_days'; end if;
  select m.business_id into bid from memberships m where m.user_id = auth.uid() and m.active and m.role in ('owner','admin') limit 1;
  if bid is null then raise exception 'forbidden'; end if;
  update businesses set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('reactivation', jsonb_build_object('enabled', p_enabled, 'days', p_days))
    where id = bid returning settings->'reactivation' into s;
  return s;
end $$;
revoke all on function public.set_reactivation_settings(boolean, int) from public, anon;
grant execute on function public.set_reactivation_settings(boolean, int) to authenticated;
