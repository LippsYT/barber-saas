-- 0004: negocio, invitaciones, reserva pública
create or replace function public.require_auth() returns uuid
language plpgsql stable as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return auth.uid();
end $$;

create or replace function public.create_business(p_name text, p_slug text, p_display_name text,
  p_timezone text default 'America/Bogota', p_currency text default 'COP', p_owner_bookable boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := require_auth(); bid uuid; s text := slugify(coalesce(nullif(p_slug,''), p_name));
begin
  if s = '' then raise exception 'invalid_slug'; end if;
  if exists(select 1 from businesses where slug = s) then raise exception 'slug_taken'; end if;
  insert into businesses(name, slug, timezone, currency) values (trim(p_name), s, p_timezone, p_currency) returning id into bid;
  insert into memberships(business_id, user_id, display_name, role, is_bookable)
    values (bid, uid, coalesce(nullif(trim(p_display_name),''), 'Dueño'), 'owner', p_owner_bookable);
  insert into expense_categories(business_id, name)
    select bid, n from unnest(array['Insumos','Arriendo','Servicios públicos','Nómina','Otros']) n;
  -- Reglas por defecto (editables): servicios 50 % neto, productos 10 % bruto, propinas 100 %
  insert into commission_rules(business_id, item_type, kind, value, base) values
    (bid, 'service', 'percent', 50, 'net_of_discount'),
    (bid, 'product', 'percent', 10, 'gross'),
    (bid, 'tip', 'percent', 100, 'gross');
  return bid;
end $$;

-- Vincula invitaciones por email (membresías sin user_id) a la cuenta que inicia sesión.
create or replace function public.claim_my_invitations() returns integer
language plpgsql security definer set search_path = public as $$
declare uid uuid := require_auth(); em text; n integer;
begin
  select lower(email) into em from auth.users where id = uid;
  update memberships set user_id = uid
    where user_id is null and active and lower(invited_email) = em
      and not exists (select 1 from memberships x where x.business_id = memberships.business_id and x.user_id = uid);
  get diagnostics n = row_count;
  return n;
end $$;

-- ===== mensajes de cita =====
create or replace function public.schedule_reminders(p_appt uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a appointments; c clients; b businesses; txt text;
begin
  select * into a from appointments where id = p_appt;
  if not found or a.client_id is null then return; end if;
  select * into c from clients where id = a.client_id;
  select * into b from businesses where id = a.business_id;
  if not c.whatsapp_opt_in or c.phone is null then return; end if;
  txt := format('Hola %s, te recordamos tu cita en %s el %s.', c.full_name, b.name,
                to_char(a.starts_at at time zone b.timezone, 'DD/MM "a las" HH24:MI'));
  insert into scheduled_messages(business_id, client_id, appointment_id, kind, to_phone, payload, send_at)
    select a.business_id, c.id, a.id, 'reminder', c.phone, jsonb_build_object('body', txt), a.starts_at - h
    from unnest(array[interval '24 hours', interval '2 hours']) h
    where a.starts_at - h > now();
end $$;

create trigger appointments_msg_sync_au after update on appointments
  for each row execute function appointments_msg_sync();

-- ===== reserva pública (anon) =====
create or replace function public._booking_quote(p_member uuid, p_service_ids uuid[])
returns table(duration_min integer, total bigint)
language sql stable security definer set search_path = public as $$
  select sum(coalesce(ms.duration_override, s.duration_min))::int, sum(coalesce(ms.price_override, s.price))::bigint
  from services s join member_services ms on ms.service_id = s.id and ms.member_id = p_member
  where s.id = any(p_service_ids) and s.active
  having count(*) = (select count(distinct x) from unnest(p_service_ids) x) and count(*) > 0
$$;

create or replace function public._member_slots(p_bid uuid, p_member uuid, p_date date, p_duration integer)
returns table(slot_start timestamptz, slot_end timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare b businesses; step int; notice int; adv int; w record; t timestamptz; wend timestamptz;
begin
  select * into b from businesses where id = p_bid;
  step := greatest(coalesce((b.settings->>'slot_step_min')::int, 15), 5);
  notice := coalesce((b.settings->>'min_notice_min')::int, 60);
  adv := coalesce((b.settings->>'max_advance_days')::int, 30);
  for w in select start_time, end_time from working_hours
           where member_id = p_member and weekday = extract(dow from p_date)::int order by start_time loop
    t := (p_date + w.start_time) at time zone b.timezone;
    wend := (p_date + w.end_time) at time zone b.timezone;
    while t + make_interval(mins => p_duration) <= wend loop
      if t >= now() + make_interval(mins => notice)
         and t <= now() + make_interval(days => adv)
         and not exists (select 1 from appointments a where a.member_id = p_member
                         and a.status not in ('cancelled','no_show')
                         and tstzrange(a.starts_at, a.ends_at) && tstzrange(t, t + make_interval(mins => p_duration)))
         and not exists (select 1 from time_off o where o.member_id = p_member
                         and tstzrange(o.starts_at, o.ends_at) && tstzrange(t, t + make_interval(mins => p_duration)))
      then
        slot_start := t; slot_end := t + make_interval(mins => p_duration); return next;
      end if;
      t := t + make_interval(mins => step);
    end loop;
  end loop;
end $$;

create or replace function public.public_get_catalog(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b businesses;
begin
  select * into b from businesses where slug = p_slug;
  if not found then return null; end if;
  return jsonb_build_object(
    'business', jsonb_build_object('name', b.name, 'slug', b.slug, 'timezone', b.timezone, 'currency', b.currency,
                                   'phone', b.phone, 'address', b.address,
                                   'max_advance_days', coalesce((b.settings->>'max_advance_days')::int, 30)),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'duration_min', s.duration_min, 'price', s.price)
                          order by s.name) from services s where s.business_id = b.id and s.active), '[]'),
    'barbers', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'name', m.display_name, 'slug', m.booking_slug,
        'weekdays', coalesce((select jsonb_agg(distinct w.weekday) from working_hours w where w.member_id = m.id), '[]'),
        'services', coalesce((select jsonb_agg(jsonb_build_object('service_id', ms.service_id,
              'price', coalesce(ms.price_override, s.price), 'duration_min', coalesce(ms.duration_override, s.duration_min)))
              from member_services ms join services s on s.id = ms.service_id and s.active where ms.member_id = m.id), '[]')
      ) order by m.display_name) from memberships m where m.business_id = b.id and m.is_bookable and m.active), '[]'));
end $$;

create or replace function public.public_get_availability(p_slug text, p_member uuid, p_service_ids uuid[], p_date date)
returns table(member_id uuid, member_name text, slot_start timestamptz, slot_end timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare bid uuid; m record; q record;
begin
  select id into bid from businesses where slug = p_slug;
  if bid is null or p_date is null or coalesce(array_length(p_service_ids, 1), 0) = 0 then return; end if;
  for m in select id, display_name from memberships
           where business_id = bid and is_bookable and active and (p_member is null or id = p_member) order by display_name loop
    select * into q from _booking_quote(m.id, p_service_ids);
    continue when q.duration_min is null;
    return query select m.id, m.display_name, s.slot_start, s.slot_end from _member_slots(bid, m.id, p_date, q.duration_min) s;
  end loop;
end $$;

create or replace function public.public_create_booking(p_slug text, p_member uuid, p_service_ids uuid[],
  p_starts_at timestamptz, p_name text, p_phone text, p_opt_in boolean default false, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b businesses; m memberships; q record; v_phone text; cid uuid; aid uuid; tok text; ends timestamptz; recent int;
begin
  select * into b from businesses where slug = p_slug;
  if not found then raise exception 'business_not_found'; end if;
  select * into m from memberships where id = p_member and business_id = b.id and is_bookable and active;
  if not found then raise exception 'barber_not_found'; end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(p_name) > 80 then raise exception 'invalid_name'; end if;
  v_phone := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
  if length(v_phone) < 7 or length(v_phone) > 15 then raise exception 'invalid_phone'; end if;
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

  select id into cid from clients where business_id = b.id and phone = v_phone;
  if cid is null then
    insert into clients(business_id, full_name, phone, whatsapp_opt_in) values (b.id, trim(p_name), v_phone, coalesce(p_opt_in,false)) returning id into cid;
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
    insert into scheduled_messages(business_id, client_id, appointment_id, kind, to_phone, payload, send_at)
      values (b.id, cid, aid, 'confirmation', v_phone, jsonb_build_object('body',
        format('¡Listo %s! Tu cita en %s con %s es el %s. Para cancelar: /b/%s/cita/%s', trim(p_name), b.name, m.display_name,
               to_char(p_starts_at at time zone b.timezone, 'DD/MM "a las" HH24:MI'), b.slug, tok)), now());
    perform schedule_reminders(aid);
  end if;
  return jsonb_build_object('appointment_id', aid, 'manage_token', tok, 'starts_at', p_starts_at, 'ends_at', ends,
                            'member_name', m.display_name, 'total', q.total);
end $$;

create or replace function public.public_get_booking(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('status', a.status, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'member_name', m.display_name,
    'business_name', b.name, 'slug', b.slug, 'timezone', b.timezone, 'currency', b.currency,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'price', i.price)), '[]') from appointment_items i where i.appointment_id = a.id))
  from appointments a join memberships m on m.id = a.member_id join businesses b on b.id = a.business_id
  where a.manage_token = p_token
$$;

create or replace function public.public_cancel_booking(p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update appointments set status = 'cancelled', cancel_reason = 'Cancelada por el cliente'
    where manage_token = p_token and status in ('reserved','confirmed') and starts_at > now();
  get diagnostics n = row_count;
  return n > 0;
end $$;
