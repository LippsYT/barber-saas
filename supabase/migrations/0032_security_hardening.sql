-- Endurecimiento de seguridad (auditoría). Todo lo de abajo es idempotente (create or replace / drop if exists).
--  C1  whatsapp_links ya no se escribe directo: el nombre de la instancia se deriva del slug y "conectado" solo lo marca el servidor.
--  H1  las referencias a barbero, cliente, servicio o cita deben ser del mismo negocio (un negocio no puede tocar la agenda de otro).
--  H2  la reserva pública limpia el nombre (sin links en los mensajes) y tiene tope por negocio.
--  H3  las RPC del worker ya no aceptan el secreto crudo: cada dominio usa su propio token derivado (sha256 de "dominio:secreto").
--  M1  el bloqueo por falta de pago y los complementos también se exigen en SQL (_need_role, schedule_message, reactivación).
--  M2  tope de negocios por usuario y correo confirmado para crear uno.   M3  push solo hacia servicios de push conocidos.
--  M5  barberos: sin editar clientes, ni precios de citas, ni cerrar citas a mano, descuento topado.   M6  gracia de 10 días para pagos fallidos.
--  M7  invitaciones solo con correo confirmado.   M8  límites del bucket y nada de listar archivos.   L2/L4/L5/L6/L7/L9/L11 y último dueño.

-- ===== H3: token derivado por dominio =====
create or replace function public._cron_ok(p_secret text, p_scope text) returns boolean
language sql stable security definer set search_path = public, vault as $$
  select p_secret is not null and p_scope is not null and exists (
    select 1 from vault.decrypted_secrets where name = 'cron_secret' and length(decrypted_secret) >= 32
      and p_secret = encode(sha256(convert_to(p_scope || ':' || decrypted_secret, 'utf8')), 'hex'))
$$;
revoke all on function public._cron_ok(text, text) from public, anon, authenticated;
-- El secreto crudo ya no abre nada.
create or replace function public._cron_ok(p_secret text) returns boolean language sql stable as $$ select false $$;
revoke all on function public._cron_ok(text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.msg_claim(p_secret text, p_limit integer DEFAULT 20, p_appointment uuid DEFAULT NULL::uuid, p_id uuid DEFAULT NULL::uuid, p_fallback_instance text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, business_id uuid, kind text, to_phone text, body text, attempts integer, instance_name text, to_email text, appointment_id uuid, short_token text, media text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not _cron_ok(p_secret, 'messages') then raise exception 'forbidden'; end if;
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
    returning s.id, s.business_id, s.kind, s.to_phone, s.payload->>'body' as body, s.attempts, s.client_id, s.appointment_id, s.payload->>'media' as media
  )
  select u.id, u.business_id, u.kind, u.to_phone, u.body, u.attempts,
         coalesce((select w.instance_name from whatsapp_links w where w.business_id = u.business_id and w.status = 'connected' and not w.demo), nullif(p_fallback_instance, '')),
         (select cl.email from clients cl where cl.id = u.client_id), u.appointment_id,
         (select ap.short_token from appointments ap where ap.id = u.appointment_id), u.media
  from u;
end $function$;

CREATE OR REPLACE FUNCTION public.msg_finish(p_secret text, p_id uuid, p_status text, p_provider_id text DEFAULT NULL::text, p_error text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a int; st text;
begin
  if not _cron_ok(p_secret, 'messages') then raise exception 'forbidden'; end if;
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
end $function$;

CREATE OR REPLACE FUNCTION public.billing_link_customer(p_secret text, p_business uuid, p_customer text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not _cron_ok(p_secret, 'billing') then raise exception 'forbidden'; end if;
  insert into subscriptions(business_id, stripe_customer_id) values (p_business, p_customer)
  on conflict (business_id) do update set stripe_customer_id = excluded.stripe_customer_id, updated_at = now();
end $function$;

CREATE OR REPLACE FUNCTION public.billing_sync(p_secret text, p_customer text, p_subscription text, p_status text, p_period_end timestamp with time zone, p_trial_end timestamp with time zone, p_cancel boolean, p_addons text[] DEFAULT NULL::text[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int;
begin
  if not _cron_ok(p_secret, 'billing') then raise exception 'forbidden'; end if;
  update subscriptions set stripe_subscription_id = p_subscription, status = p_status, current_period_end = p_period_end,
    trial_end = p_trial_end, cancel_at_period_end = coalesce(p_cancel, false), addons = coalesce(p_addons, addons), updated_at = now()
  where stripe_customer_id = p_customer;
  get diagnostics n = row_count;
  return n > 0;
end $function$;

CREATE OR REPLACE FUNCTION public.report_targets(p_secret text)
 RETURNS TABLE(business_id uuid, name text, timezone text, currency text, owner_email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not _cron_ok(p_secret, 'report') then raise exception 'forbidden'; end if;
  return query
    select b.id, b.name, b.timezone, b.currency, u.email::text
    from businesses b
    join memberships m on m.business_id = b.id and m.role = 'owner' and m.active
    join auth.users u on u.id = m.user_id
    where coalesce((b.settings->>'weekly_report')::boolean, false) and u.email is not null and _biz_has(b.id, 'informes');
end $function$;

CREATE OR REPLACE FUNCTION public.report_data(p_secret text, p_business uuid, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare income bigint; tips bigint; spent bigint;
begin
  if not _cron_ok(p_secret, 'report') then raise exception 'forbidden'; end if;
  select coalesce(sum(direction * amount) filter (where type = 'sale_income'), 0),
         coalesce(sum(direction * amount) filter (where type = 'tip_income'), 0),
         coalesce(-sum(direction * amount) filter (where type in ('expense', 'cash_out')), 0)
    into income, tips, spent
  from ledger_entries
  where business_id = p_business and occurred_at >= p_from and occurred_at < p_to and account in ('cash', 'bank', 'card_clearing');
  return jsonb_build_object(
    'income', income, 'tips', tips, 'expenses', spent,
    'appointments', coalesce((select jsonb_object_agg(status, n) from (
        select status::text, count(*) n from appointments where business_id = p_business and starts_at >= p_from and starts_at < p_to group by status) s), '{}'),
    'new_clients', (select count(*) from clients where business_id = p_business and created_at >= p_from and created_at < p_to),
    'top_services', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'n', n, 'total', total) order by n desc, total desc) from (
        select i.name, count(*) n, coalesce(sum(i.price), 0) total
        from appointment_items i join appointments a on a.id = i.appointment_id
        where a.business_id = p_business and a.status = 'completed' and a.starts_at >= p_from and a.starts_at < p_to
        group by i.name order by count(*) desc, sum(i.price) desc limit 5) t), '[]'),
    'by_barber', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'n', n) order by n desc) from (
        select m.display_name name, count(*) n from appointments a join memberships m on m.id = a.member_id
        where a.business_id = p_business and a.status = 'completed' and a.starts_at >= p_from and a.starts_at < p_to
        group by m.display_name order by count(*) desc limit 5) t), '[]'));
end $function$;

CREATE OR REPLACE FUNCTION public.push_vapid(p_secret text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not _cron_ok(p_secret, 'push') then raise exception 'forbidden'; end if;
  return (select jsonb_build_object('public', public_key, 'private', private_key) from push_config where id);
end $function$;

CREATE OR REPLACE FUNCTION public.push_vapid_set(p_secret text, p_public text, p_private text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not _cron_ok(p_secret, 'push') then raise exception 'forbidden'; end if;
  insert into push_config(id, public_key, private_key) values (true, p_public, p_private) on conflict (id) do nothing;
end $function$;

CREATE OR REPLACE FUNCTION public.push_claim(p_secret text, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare out jsonb;
begin
  if not _cron_ok(p_secret, 'push') then raise exception 'forbidden'; end if;
  with d as (
    delete from push_outbox where id in (select id from push_outbox order by id limit least(greatest(coalesce(p_limit, 50), 1), 200) for update skip locked) returning *
  )
  select coalesce(jsonb_agg(jsonb_build_object('title', d.title, 'body', d.body, 'url', d.url, 'subs',
      (select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
       from push_subscriptions s where s.user_id = any(d.user_ids) and s.business_id = d.business_id)) order by d.id), '[]'::jsonb)
  into out from d;
  return out;
end $function$;

CREATE OR REPLACE FUNCTION public.push_prune(p_secret text, p_endpoints text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int;
begin
  if not _cron_ok(p_secret, 'push') then raise exception 'forbidden'; end if;
  delete from push_subscriptions where endpoint = any(p_endpoints);
  get diagnostics n = row_count;
  return n;
end $function$;


-- ===== C1: WhatsApp =====
drop policy if exists wa_all on whatsapp_links;
revoke insert, update, delete on whatsapp_links from authenticated;
create or replace function public.wa_link_start(p_phone text, p_code text, p_provider text, p_demo boolean) returns void
language plpgsql security definer set search_path = public as $$
declare bid uuid; sl text;
begin
  select m.business_id, b.slug into bid, sl from memberships m join businesses b on b.id = m.business_id
    where m.user_id = auth.uid() and m.active and m.role in ('owner', 'admin') limit 1;
  if bid is null then raise exception 'forbidden'; end if;
  if p_phone !~ '^[0-9]{8,15}$' or p_provider not in ('evolution', 'mock') or length(coalesce(p_code, '')) > 40 then raise exception 'invalid_link'; end if;
  insert into whatsapp_links(business_id, phone, instance_name, pairing_code, status, provider, demo, updated_at)
  values (bid, p_phone, left('pulso-' || sl, 40), p_code, 'pairing', p_provider, coalesce(p_demo, false), now())
  on conflict (business_id) do update set phone = excluded.phone, instance_name = excluded.instance_name, pairing_code = excluded.pairing_code,
    status = 'pairing', provider = excluded.provider, demo = excluded.demo, updated_at = now();
end $$;
revoke all on function public.wa_link_start(text, text, text, boolean) from public, anon;
grant execute on function public.wa_link_start(text, text, text, boolean) to authenticated;
-- Modo demo: confirmar el código marca "conectado" solo si la fila es demo (los mensajes demo nunca salen por un número real).
create or replace function public.wa_link_demo_confirm() returns void
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  select m.business_id into bid from memberships m where m.user_id = auth.uid() and m.active and m.role in ('owner', 'admin') limit 1;
  if bid is null then raise exception 'forbidden'; end if;
  update whatsapp_links set status = 'connected', updated_at = now() where business_id = bid and demo and status = 'pairing';
end $$;
revoke all on function public.wa_link_demo_confirm() from public, anon;
grant execute on function public.wa_link_demo_confirm() to authenticated;
-- Solo el servidor (que habló con Evolution) marca una conexión real como conectada.
create or replace function public.wa_link_status(p_secret text, p_business uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not _cron_ok(p_secret, 'wa') then raise exception 'forbidden'; end if;
  if p_status not in ('connected', 'disconnected', 'pairing') then raise exception 'invalid_link'; end if;
  update whatsapp_links set status = p_status, updated_at = now() where business_id = p_business and not demo;
end $$;
revoke all on function public.wa_link_status(text, uuid, text) from public;
grant execute on function public.wa_link_status(text, uuid, text) to anon, authenticated;

-- ===== H1: referencias del mismo negocio =====
create or replace function public._same_tenant() returns trigger
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if tg_table_name in ('working_hours', 'time_off', 'member_compensation') then
    ok := exists (select 1 from memberships where id = new.member_id and business_id = new.business_id);
  elsif tg_table_name = 'member_services' then
    ok := exists (select 1 from memberships where id = new.member_id and business_id = new.business_id)
      and exists (select 1 from services where id = new.service_id and business_id = new.business_id);
  elsif tg_table_name = 'appointments' then
    ok := exists (select 1 from memberships where id = new.member_id and business_id = new.business_id)
      and (new.client_id is null or exists (select 1 from clients where id = new.client_id and business_id = new.business_id));
  elsif tg_table_name = 'appointment_items' then
    ok := exists (select 1 from appointments where id = new.appointment_id and business_id = new.business_id)
      and (new.service_id is null or exists (select 1 from services where id = new.service_id and business_id = new.business_id));
  elsif tg_table_name = 'commission_rules' then
    ok := new.member_id is null or exists (select 1 from memberships where id = new.member_id and business_id = new.business_id);
  elsif tg_table_name = 'products' then
    ok := new.supplier_id is null or exists (select 1 from suppliers where id = new.supplier_id and business_id = new.business_id);
  else ok := true; end if;
  if not ok then raise exception 'forbidden'; end if;
  return new;
end $$;
revoke all on function public._same_tenant() from public, anon, authenticated;
drop trigger if exists same_tenant_wh on working_hours;
create trigger same_tenant_wh before insert or update on working_hours for each row execute function _same_tenant();
drop trigger if exists same_tenant_to on time_off;
create trigger same_tenant_to before insert or update on time_off for each row execute function _same_tenant();
drop trigger if exists same_tenant_mc on member_compensation;
create trigger same_tenant_mc before insert or update on member_compensation for each row execute function _same_tenant();
drop trigger if exists same_tenant_ms on member_services;
create trigger same_tenant_ms before insert or update on member_services for each row execute function _same_tenant();
drop trigger if exists same_tenant_ap on appointments;
create trigger same_tenant_ap before insert or update of business_id, member_id, client_id on appointments for each row execute function _same_tenant();
drop trigger if exists same_tenant_ai on appointment_items;
create trigger same_tenant_ai before insert or update on appointment_items for each row execute function _same_tenant();
drop trigger if exists same_tenant_cr on commission_rules;
create trigger same_tenant_cr before insert or update on commission_rules for each row execute function _same_tenant();
drop trigger if exists same_tenant_pr on products;
create trigger same_tenant_pr before insert or update on products for each row execute function _same_tenant();

-- ===== H2 + M2 + M7 =====
CREATE OR REPLACE FUNCTION public.public_create_booking(p_slug text, p_member uuid, p_service_ids uuid[], p_starts_at timestamp with time zone, p_name text, p_phone text, p_opt_in boolean DEFAULT false, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b businesses; m memberships; q record; v_phone text; cid uuid; aid uuid; tok text; ends timestamptz; recent int; v_name text;
begin
  select * into b from businesses where slug = p_slug;
  if not found then raise exception 'business_not_found'; end if;
  select * into m from memberships where id = p_member and business_id = b.id and is_bookable and active;
  if not found then raise exception 'barber_not_found'; end if;
  v_name := regexp_replace(trim(regexp_replace(coalesce(p_name, ''), '[^a-zA-ZÀ-ÿ ''-]', '', 'g')), '\s+', ' ', 'g');
  if length(v_name) < 2 or length(v_name) > 60 then raise exception 'invalid_name'; end if;
  v_phone := normalize_phone(p_phone, b.phone_country_code);
  if v_phone is null or length(v_phone) < 9 or length(v_phone) > 16 then raise exception 'invalid_phone'; end if;
  select * into q from _booking_quote(m.id, p_service_ids);
  if q.duration_min is null then raise exception 'service_not_available'; end if;
  ends := p_starts_at + make_interval(mins => q.duration_min);
  if not exists (select 1 from _member_slots(b.id, m.id, (p_starts_at at time zone b.timezone)::date, q.duration_min) s
                 where s.slot_start = p_starts_at) then
    raise exception 'slot_taken';
  end if;
  select count(*) into recent from appointments a join clients c on c.id = a.client_id
    where a.business_id = b.id and a.source = 'booking_link' and c.phone = v_phone and a.created_at > now() - interval '1 hour';
  if recent >= 5 then raise exception 'too_many_requests'; end if;
  if (select count(*) from appointments a where a.business_id = b.id and a.source = 'booking_link' and a.created_at > now() - interval '1 hour') >= 40 then raise exception 'too_many_requests'; end if;

  select id into cid from clients where business_id = b.id and phone = v_phone;
  if cid is null then
    insert into clients(business_id, full_name, phone, whatsapp_opt_in) values (b.id, v_name, v_phone, coalesce(p_opt_in,false)) returning id into cid;
  end if;
  begin
    insert into appointments(business_id, client_id, member_id, starts_at, ends_at, source, notes)
      values (b.id, cid, m.id, p_starts_at, ends, 'booking_link', left(p_notes, 500)) returning id, manage_token into aid, tok;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;
  insert into appointment_items(business_id, appointment_id, service_id, name, price, duration_min)
    select b.id, aid, s.id, s.name, coalesce(ms.price_override, s.price), coalesce(ms.duration_override, s.duration_min)
    from services s join member_services ms on ms.service_id = s.id and ms.member_id = m.id where s.id = any(p_service_ids);

  if exists (select 1 from clients where id = cid and whatsapp_opt_in) then
    if _msg_on(b.id, 'confirmation') then
      insert into scheduled_messages(business_id, client_id, appointment_id, kind, to_phone, payload, send_at)
        values (b.id, cid, aid, 'confirmation', v_phone, jsonb_build_object('body', _wa_cita_body('confirmation', aid), 'media', 'og'), now())
        on conflict do nothing;
    end if;
    perform schedule_reminders(aid);
  end if;
  return jsonb_build_object('appointment_id', aid, 'manage_token', tok, 'short_token', (select short_token from appointments where id = aid), 'starts_at', p_starts_at, 'ends_at', ends,
                            'member_name', m.display_name, 'total', q.total);
end $function$;

CREATE OR REPLACE FUNCTION public.create_business(p_name text, p_slug text, p_display_name text, p_timezone text DEFAULT 'America/Bogota'::text, p_currency text DEFAULT 'USD'::text, p_owner_bookable boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := require_auth(); bid uuid; s text := slugify(coalesce(nullif(p_slug,''), p_name));
begin
  if not exists (select 1 from auth.users where id = uid and email_confirmed_at is not null) then raise exception 'email_not_confirmed'; end if;
  if (select count(*) from memberships where user_id = uid and role = 'owner' and active) >= 3 then raise exception 'too_many_businesses'; end if;
  if s = '' then raise exception 'invalid_slug'; end if;
  if exists(select 1 from businesses where slug = s) then raise exception 'slug_taken'; end if;
  insert into businesses(name, slug, timezone, currency) values (trim(p_name), s, p_timezone, p_currency) returning id into bid;
  insert into memberships(business_id, user_id, display_name, role, is_bookable)
    values (bid, uid, coalesce(nullif(trim(p_display_name),''), 'Dueño'), 'owner', p_owner_bookable);
  insert into expense_categories(business_id, name)
    select bid, n from unnest(array['Insumos','Arriendo','Servicios públicos','Nómina','Otros']) n;
  insert into commission_rules(business_id, item_type, kind, value, base) values
    (bid, 'service', 'percent', 50, 'net_of_discount'),
    (bid, 'product', 'percent', 10, 'gross'),
    (bid, 'tip', 'percent', 100, 'gross');
  return bid;
end $function$;

CREATE OR REPLACE FUNCTION public.claim_my_invitations()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := require_auth(); em text; n integer;
begin
  select lower(email) into em from auth.users where id = uid and email_confirmed_at is not null;
  update memberships set user_id = uid
    where user_id is null and active and lower(invited_email) = em
      and not exists (select 1 from memberships x where x.business_id = memberships.business_id and x.user_id = uid);
  get diagnostics n = row_count;
  return n;
end $function$;

-- ===== M1: paywall y complementos también en SQL =====
CREATE OR REPLACE FUNCTION public._need_role(bid uuid, VARIADIC roles member_role[])
 RETURNS member_role
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r member_role := my_role(bid);
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if r is null or not (r = any(roles)) then raise exception 'forbidden'; end if;
  if not _biz_active(bid) then raise exception 'payment_required'; end if;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.schedule_message(p_business uuid, p_client uuid, p_body text, p_send_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c clients; new_id uuid;
begin
  perform _need_role(p_business, 'owner', 'admin', 'receptionist');
  if not _biz_has(p_business, 'whatsapp') then raise exception 'addon_required'; end if;
  select * into c from clients where id = p_client and business_id = p_business;
  if not found then raise exception 'invalid_client'; end if;
  if not c.whatsapp_opt_in then raise exception 'client_no_opt_in'; end if;
  if c.phone is null then raise exception 'client_no_phone'; end if;
  if length(trim(coalesce(p_body,''))) < 1 then raise exception 'body_required'; end if;
  insert into scheduled_messages(business_id, client_id, kind, to_phone, payload, send_at, created_by)
    values (p_business, p_client, 'custom', c.phone, jsonb_build_object('body', p_body), p_send_at, auth.uid()) returning scheduled_messages.id into new_id;
  return new_id;
end $function$;

CREATE OR REPLACE FUNCTION public.enqueue_reactivation_now(p_client uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c clients; b businesses; lv timestamptz; d int; mid uuid;
begin
  select * into c from clients where id = p_client;
  if not found then raise exception 'not_found'; end if;
  if not exists (select 1 from memberships m where m.business_id = c.business_id and m.user_id = auth.uid()
                 and m.active and m.role in ('owner','admin')) then raise exception 'forbidden'; end if;
  if not (_biz_has(c.business_id, 'marketing') and _biz_has(c.business_id, 'whatsapp')) then raise exception 'addon_required'; end if;
  if not c.whatsapp_opt_in then raise exception 'client_no_opt_in'; end if;
  if c.phone is null then raise exception 'no_phone'; end if;
  select * into b from businesses where id = c.business_id;
  select max(starts_at) into lv from appointments where client_id = c.id and status = 'completed';
  d := coalesce((extract(epoch from now() - lv) / 86400)::int, coalesce((b.settings->'reactivation'->>'days')::int, 25));
  insert into scheduled_messages(business_id, client_id, kind, to_phone, payload, send_at, created_by)
    values (b.id, c.id, 'reactivation', c.phone, jsonb_build_object('body', _reactivation_body(c, b, d)), now(), auth.uid())
    returning id into mid;
  return mid;
end $function$;

CREATE OR REPLACE FUNCTION public.attend_appointment(p_appointment uuid, p_method pay_method, p_adjustment bigint DEFAULT 0, p_tip bigint DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a appointments; b businesses; r member_role; mine uuid; it appointment_items;
  names text[] := '{}'; ids uuid[] := '{}'; types rule_item_type[] := '{}'; mems uuid[] := '{}';
  qtys int[] := '{}'; prices bigint[] := '{}';
  n int; sub bigint := 0; adj bigint; tip bigint; charged bigint; disc bigint;
begin
  select * into a from appointments where id = p_appointment;
  if not found then raise exception 'appointment_not_found'; end if;
  r := _need_role(a.business_id, 'owner', 'admin', 'receptionist', 'barber');
  mine := my_member_id(a.business_id);
  if r = 'barber' and a.member_id <> mine then raise exception 'forbidden'; end if;
  if a.status in ('cancelled', 'no_show') then raise exception 'appointment_closed'; end if;
  if exists (select 1 from sales where appointment_id = a.id and status = 'paid') then raise exception 'already_attended'; end if;
  select * into b from businesses where id = a.business_id;
  perform _assert_day_open(a.business_id, (now() at time zone b.timezone)::date);
  if p_method not in ('cash', 'transfer') then raise exception 'invalid_method'; end if;
  for it in select * from appointment_items where appointment_id = a.id order by id loop
    names := array_append(names, it.name);
    ids := array_append(ids, it.service_id);
    types := array_append(types, 'service'::rule_item_type);
    mems := array_append(mems, a.member_id);
    qtys := array_append(qtys, 1);
    prices := array_append(prices, it.price);
    sub := sub + it.price;
  end loop;
  n := coalesce(array_length(names, 1), 0);
  if n = 0 then raise exception 'empty_sale'; end if;
  adj := coalesce(p_adjustment, 0);
  if r = 'barber' and adj < 0 and -adj > sub / 5 then raise exception 'discount_too_large'; end if;
  tip := greatest(coalesce(p_tip, 0), 0);
  if sub + adj < 0 then raise exception 'invalid_adjustment'; end if;
  if adj > 0 then
    prices[n] := prices[n] + adj;
    sub := sub + adj;
  end if;
  disc := greatest(-adj, 0);
  charged := sub - disc;
  if charged + tip <= 0 then
    update appointments set status = 'completed' where id = a.id;
    return null;
  end if;
  return _commit_sale(a.business_id, a.id, a.client_id, a.member_id, types, ids, names, mems, qtys, prices, disc, tip,
    jsonb_build_array(jsonb_build_object('method', p_method, 'amount', charged + tip)));
end $function$;

CREATE OR REPLACE FUNCTION public._biz_active(p_bid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select b.billing_exempt or b.trial_ends_at > now()
           or coalesce((select s.status in ('active', 'trialing') or (s.status = 'past_due' and coalesce(s.current_period_end, now()) > now() - interval '10 days') from subscriptions s where s.business_id = b.id), false)
    from businesses b where b.id = p_bid), false)
$function$;

CREATE OR REPLACE FUNCTION public._biz_has(p_bid uuid, p_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select _biz_all(p_bid) or coalesce((select (s.status in ('active', 'trialing') or (s.status = 'past_due' and coalesce(s.current_period_end, now()) > now() - interval '10 days')) and p_key = any(s.addons)
                                      from subscriptions s where s.business_id = p_bid), false)
$function$;

-- ===== M3 + L7: push =====
create or replace function public.push_save(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null) returns void
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  if length(coalesce(p_endpoint, '')) < 20 or length(p_endpoint) > 1000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = ''
     or p_endpoint !~* '^https://([a-z0-9-]+\.)*(googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)(:[0-9]+)?/' then
    raise exception 'invalid_subscription';
  end if;
  select m.business_id into bid from memberships m where m.user_id = auth.uid() and m.active limit 1;
  if bid is null then raise exception 'forbidden'; end if;
  insert into push_subscriptions(business_id, user_id, endpoint, p256dh, auth, user_agent)
  values (bid, auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_ua, 200))
  on conflict (endpoint) do update set business_id = excluded.business_id, user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end $$;
create or replace function public.push_test() returns void
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  select m.business_id into bid from memberships m where m.user_id = auth.uid() and m.active limit 1;
  if bid is null then raise exception 'forbidden'; end if;
  if (select count(*) from push_outbox where auth.uid() = any(user_ids) and created_at > now() - interval '1 minute') >= 5 then raise exception 'too_many_requests'; end if;
  insert into push_outbox(business_id, user_ids, title, body, url) values (bid, array[auth.uid()], 'Pulso', 'Las notificaciones funcionan en este celular.', '/app');
end $$;

-- ===== M5: fraude interno =====
drop policy if exists clients_upd on clients;
create policy clients_upd on clients for update to authenticated
  using (has_role(business_id, 'owner', 'admin', 'receptionist')) with check (has_role(business_id, 'owner', 'admin', 'receptionist'));
drop policy if exists appti_all on appointment_items;
drop policy if exists appti_sel on appointment_items; drop policy if exists appti_ins on appointment_items;
drop policy if exists appti_upd on appointment_items; drop policy if exists appti_del on appointment_items;
create policy appti_sel on appointment_items for select to authenticated using (exists (select 1 from appointments a where a.id = appointment_id));
create policy appti_ins on appointment_items for insert to authenticated with check (exists (select 1 from appointments a where a.id = appointment_id));
create policy appti_upd on appointment_items for update to authenticated
  using (exists (select 1 from appointments a where a.id = appointment_id) and has_role(business_id, 'owner', 'admin', 'receptionist'))
  with check (exists (select 1 from appointments a where a.id = appointment_id) and has_role(business_id, 'owner', 'admin', 'receptionist'));
create policy appti_del on appointment_items for delete to authenticated
  using (exists (select 1 from appointments a where a.id = appointment_id) and has_role(business_id, 'owner', 'admin', 'receptionist'));
-- Un barbero solo puede agregar a una cita el precio que tiene el servicio (con su ajuste), no uno inventado.
-- (security invoker a propósito: dentro de una función definer current_user sería el dueño y no se vería quién escribe)
create or replace function public._item_price_guard() returns trigger
language plpgsql set search_path = public as $$
declare want bigint; a appointments;
begin
  if current_user <> 'authenticated' or new.service_id is null then return new; end if;
  select * into a from appointments where id = new.appointment_id;
  if my_role(new.business_id) = 'barber' then
    select coalesce(ms.price_override, s.price) into want from services s left join member_services ms on ms.service_id = s.id and ms.member_id = a.member_id where s.id = new.service_id;
    if want is null or new.price <> want then raise exception 'forbidden'; end if;
  end if;
  return new;
end $$;
revoke all on function public._item_price_guard() from public, anon, authenticated;
drop trigger if exists appointment_items_price_guard on appointment_items;
create trigger appointment_items_price_guard before insert on appointment_items for each row execute function _item_price_guard();
-- Cerrar una cita como atendida es cobrarla: un barbero no puede marcarla a mano sin pasar por la caja.
create or replace function public._appt_status_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and new.status = 'completed' and old.status <> 'completed' and my_role(new.business_id) = 'barber' then raise exception 'forbidden'; end if;
  return new;
end $$;
revoke all on function public._appt_status_guard() from public, anon, authenticated;
drop trigger if exists appointments_status_guard on appointments;
create trigger appointments_status_guard before update of status on appointments for each row execute function _appt_status_guard();

-- ===== Último dueño =====
create or replace function public._keep_last_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'owner' and old.active and exists (select 1 from businesses where id = old.business_id)
     and (tg_op = 'DELETE' or new.role <> 'owner' or not new.active)
     and not exists (select 1 from memberships m where m.business_id = old.business_id and m.role = 'owner' and m.active and m.id <> old.id) then
    raise exception 'last_owner';
  end if;
  return coalesce(new, old);
end $$;
revoke all on function public._keep_last_owner() from public, anon, authenticated;
drop trigger if exists memberships_last_owner on memberships;
create trigger memberships_last_owner before update or delete on memberships for each row execute function _keep_last_owner();

-- ===== L4, L5, L6, L9, L11 =====
CREATE OR REPLACE FUNCTION public.public_track_link(p_slug text, p_kind text, p_block uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bid uuid;
begin
  if p_kind not in ('view', 'click') then return; end if;
  select id into bid from businesses where slug = p_slug;
  if bid is null then return; end if;
  if p_block is not null and not exists (select 1 from link_blocks where id = p_block and business_id = bid) then p_block := null; end if;
  if (select count(*) from link_events where business_id = bid and created_at > now() - interval '1 minute') > 300 then return; end if;
  insert into link_events (business_id, kind, block_id) values (bid, p_kind, p_block);
end $function$;

alter table link_blocks drop constraint if exists link_blocks_url_check;
alter table link_blocks add constraint link_blocks_url_check check (url is null or (char_length(url) <= 500 and url ~* '^(https?://|tel:|mailto:)|^/([^/]|$)'));
alter table portfolio_images drop constraint if exists portfolio_images_url_host;
alter table portfolio_images add constraint portfolio_images_url_host check (url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/') not valid;
alter table businesses drop constraint if exists businesses_cover_url_host;
alter table businesses add constraint businesses_cover_url_host check (cover_url is null or cover_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/') not valid;
alter table businesses drop constraint if exists businesses_slug_not_reserved;
alter table businesses add constraint businesses_slug_not_reserved check (slug <> all (array['app','api','b','c','l','login','logout','signup','register','onboarding','auth','admin','dashboard','_next','static','img','images','assets','public','cita','reservar','book','precios','pricing','terms','privacy','privacidad','terminos','help','ayuda','soporte','www','captura','mascot','manifest','sw']));
revoke all on function public._usd(numeric), public._fecha_es(timestamptz, text) from public, anon, authenticated;

-- ===== M8: bucket de imágenes =====
do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'storage no está en esta base: omitido';
    return;
  end if;
  update storage.buckets set file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] where id in ('avatars', 'covers');
  -- Las imágenes siguen públicas por su URL; lo que se cierra es listar el bucket.
  drop policy if exists avatars_public_read on storage.objects;
  drop policy if exists covers_public_read on storage.objects;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'avatars_member_delete') then
    execute $p$create policy avatars_member_delete on storage.objects for delete to authenticated using (
      bucket_id in ('avatars', 'covers')
      and (storage.foldername(name))[1] in (select m.business_id::text from memberships m where m.user_id = auth.uid() and m.active and m.role in ('owner', 'admin')))$p$;
  end if;
exception when others then
  raise notice 'storage: %', sqlerrm;
end $$;
