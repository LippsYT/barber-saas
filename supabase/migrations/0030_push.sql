-- Notificaciones push (Web Push) para la app instalada en la pantalla de inicio.
-- · push_subscriptions: un dispositivo suscrito de una persona. Solo se escribe con push_save.
-- · push_config: claves VAPID. Se generan solas la primera vez desde el servidor y solo se leen con el secreto del worker.
-- · push_outbox: avisos por enviar. El trigger de citas los encola y avisa al servidor (pg_net) para que los mande.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on push_subscriptions(user_id);
alter table push_subscriptions enable row level security;
drop policy if exists push_subs_sel on push_subscriptions;
create policy push_subs_sel on push_subscriptions for select to authenticated using (user_id = auth.uid());
revoke all on push_subscriptions from public, anon, authenticated;
grant select on push_subscriptions to authenticated;

create table if not exists push_config (
  id boolean primary key default true check (id),
  public_key text not null,
  private_key text not null
);
alter table push_config enable row level security;
revoke all on push_config from public, anon, authenticated;

create table if not exists push_outbox (
  id bigserial primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  user_ids uuid[] not null,
  title text not null,
  body text not null,
  url text not null default '/app',
  created_at timestamptz not null default now()
);
alter table push_outbox enable row level security;
revoke all on push_outbox from public, anon, authenticated;

-- Guarda (o actualiza) el dispositivo de quien lo pide, en su negocio activo.
create or replace function public.push_save(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null) returns void
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  if length(coalesce(p_endpoint, '')) < 20 or length(p_endpoint) > 1000 or p_endpoint !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then raise exception 'invalid_subscription'; end if;
  select m.business_id into bid from memberships m where m.user_id = auth.uid() and m.active limit 1;
  if bid is null then raise exception 'forbidden'; end if;
  insert into push_subscriptions(business_id, user_id, endpoint, p256dh, auth, user_agent)
  values (bid, auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_ua, 200))
  on conflict (endpoint) do update set business_id = excluded.business_id, user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end $$;
revoke all on function public.push_save(text, text, text, text) from public, anon;
grant execute on function public.push_save(text, text, text, text) to authenticated;

create or replace function public.push_remove(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;
revoke all on function public.push_remove(text) from public, anon;
grant execute on function public.push_remove(text) to authenticated;

-- Claves VAPID: lectura y primera escritura solo con el secreto del worker. La clave pública la ve cualquier persona con sesión.
create or replace function public.push_vapid(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not _cron_ok(p_secret) then raise exception 'forbidden'; end if;
  return (select jsonb_build_object('public', public_key, 'private', private_key) from push_config where id);
end $$;
create or replace function public.push_vapid_set(p_secret text, p_public text, p_private text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not _cron_ok(p_secret) then raise exception 'forbidden'; end if;
  insert into push_config(id, public_key, private_key) values (true, p_public, p_private) on conflict (id) do nothing;
end $$;
create or replace function public.push_public_key() returns text
language sql stable security definer set search_path = public as $$
  select public_key from push_config where id and auth.uid() is not null
$$;
revoke all on function public.push_vapid(text), public.push_vapid_set(text, text, text), public.push_public_key() from public;
grant execute on function public.push_vapid(text), public.push_vapid_set(text, text, text) to anon, authenticated;
grant execute on function public.push_public_key() to authenticated;

-- Saca los avisos pendientes con los dispositivos de cada destinatario. Los borra de la cola.
create or replace function public.push_claim(p_secret text, p_limit int default 50) returns jsonb
language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  if not _cron_ok(p_secret) then raise exception 'forbidden'; end if;
  with d as (
    delete from push_outbox where id in (select id from push_outbox order by id limit least(greatest(coalesce(p_limit, 50), 1), 200) for update skip locked) returning *
  )
  select coalesce(jsonb_agg(jsonb_build_object('title', d.title, 'body', d.body, 'url', d.url, 'subs',
      (select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
       from push_subscriptions s where s.user_id = any(d.user_ids) and s.business_id = d.business_id)) order by d.id), '[]'::jsonb)
  into out from d;
  return out;
end $$;
create or replace function public.push_prune(p_secret text, p_endpoints text[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not _cron_ok(p_secret) then raise exception 'forbidden'; end if;
  delete from push_subscriptions where endpoint = any(p_endpoints);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.push_claim(text, int), public.push_prune(text, text[]) from public;
grant execute on function public.push_claim(text, int), public.push_prune(text, text[]) to anon, authenticated;

-- Avisa al servidor que hay avisos por enviar (igual que el worker de mensajes). Sin pg_net o sin secretos no hace nada.
create or replace function public._push_kick() returns void
language plpgsql security definer set search_path = public, vault as $$
declare s text; byp text; h jsonb; u text;
begin
  if to_regnamespace('net') is null then return; end if;
  u := _app_base_url();
  select decrypted_secret into s from vault.decrypted_secrets where name = 'cron_secret';
  select decrypted_secret into byp from vault.decrypted_secrets where name = 'vercel_bypass';
  if coalesce(u, '') = '' or s is null then return; end if;
  h := jsonb_build_object('Authorization', 'Bearer ' || s, 'Content-Type', 'application/json');
  if byp is not null then h := h || jsonb_build_object('x-vercel-protection-bypass', byp); end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := 15000)' using u || '/api/push/send', h, '{}'::jsonb;
exception when others then null; -- un aviso que no sale nunca debe romper una reserva
end $$;
revoke all on function public._push_kick() from public, anon, authenticated;

-- Reservas hechas por el cliente y cancelaciones del cliente: avisan al dueño, a los admins y al barbero de la cita.
create or replace function public._push_on_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
declare c clients; m memberships; b businesses; uids uuid[]; ttl text; msg text;
begin
  if tg_op = 'INSERT' then
    if new.source = 'admin' or new.status in ('cancelled', 'no_show') then return null; end if;
    ttl := 'Nueva reserva';
  else
    if not (new.status = 'cancelled' and old.status <> 'cancelled' and auth.uid() is null) then return null; end if;
    ttl := 'Cita cancelada';
  end if;
  select * into b from businesses where id = new.business_id;
  select * into m from memberships where id = new.member_id;
  select * into c from clients where id = new.client_id;
  select coalesce(array_agg(distinct x.user_id), '{}') into uids from (
    select user_id from memberships where business_id = new.business_id and active and role in ('owner', 'admin') and user_id is not null
    union select m.user_id where m.user_id is not null) x;
  if coalesce(array_length(uids, 1), 0) = 0 or not exists (select 1 from push_subscriptions s where s.user_id = any(uids)) then return null; end if;
  msg := format('%s · %s · con %s', coalesce(nullif(trim(c.full_name), ''), 'Un cliente'), _fecha_es(new.starts_at, b.timezone), m.display_name);
  insert into push_outbox(business_id, user_ids, title, body, url) values (new.business_id, uids, ttl, msg, '/app/agenda');
  perform _push_kick();
  return null;
end $$;
revoke all on function public._push_on_appointment() from public, anon, authenticated;
drop trigger if exists appointments_push_ai on appointments;
create trigger appointments_push_ai after insert on appointments for each row execute function _push_on_appointment();
drop trigger if exists appointments_push_au on appointments;
create trigger appointments_push_au after update of status on appointments for each row execute function _push_on_appointment();

-- Aviso de prueba para quien lo pide (botón "Enviar prueba").
create or replace function public.push_test() returns void
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  select m.business_id into bid from memberships m where m.user_id = auth.uid() and m.active limit 1;
  if bid is null then raise exception 'forbidden'; end if;
  insert into push_outbox(business_id, user_ids, title, body, url) values (bid, array[auth.uid()], 'Pulso', 'Las notificaciones funcionan en este celular.', '/app');
end $$;
revoke all on function public.push_test() from public, anon;
grant execute on function public.push_test() to authenticated;
