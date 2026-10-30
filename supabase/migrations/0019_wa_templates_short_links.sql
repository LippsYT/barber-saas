-- 0019: links cortos /c/<short_token> + textos de WhatsApp con formato.
-- Los cuerpos usan el marcador {{BASE}}; el sender lo reemplaza por la URL base del deploy (env).
create or replace function public._short_token(n int default 9) returns text
language plpgsql volatile set search_path = public as $$
declare a text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'; r bytea := decode(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex'); s text := ''; i int;
begin
  for i in 0..n-1 loop s := s || substr(a, (get_byte(r, i) % 62) + 1, 1); end loop;
  return s;
end $$;

alter table appointments add column if not exists short_token text;
update appointments set short_token = _short_token() where short_token is null;
alter table appointments alter column short_token set default _short_token();
alter table appointments alter column short_token set not null;
create unique index if not exists appointments_short_token_key on appointments(short_token);

-- /c/<short> → slug + manage_token (público, solo con el token corto).
create or replace function public.public_short_lookup(p_short text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('slug', b.slug, 'manage_token', a.manage_token)
  from appointments a join businesses b on b.id = a.business_id where a.short_token = p_short
$$;
grant execute on function public.public_short_lookup(text) to anon, authenticated;

-- Datos de la tarjeta OG (sin datos del cliente). Acepta token corto o manage_token.
create or replace function public.public_short_card(p_short text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('business', b.name, 'barber', m.display_name, 'starts_at', a.starts_at, 'timezone', b.timezone,
    'status', a.status, 'address', b.address,
    'services', (select string_agg(i.name, ' + ' order by i.name) from appointment_items i where i.appointment_id = a.id),
    'total', (select sum(i.price) from appointment_items i where i.appointment_id = a.id))
  from appointments a join businesses b on b.id = a.business_id join memberships m on m.id = a.member_id
  where a.short_token = p_short or a.manage_token = p_short
$$;
grant execute on function public.public_short_card(text) to anon, authenticated;

-- "Sábado 31 de octubre, 10:10 a. m." en la zona del negocio.
create or replace function public._fecha_es(p_ts timestamptz, p_tz text) returns text
language sql immutable as $$
  select (array['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'])[extract(dow from l)::int + 1]
    || ' ' || extract(day from l)::int || ' de '
    || (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[extract(month from l)::int]
    || ', ' || ((extract(hour from l)::int + 11) % 12 + 1) || ':' || to_char(l, 'MI')
    || case when extract(hour from l) < 12 then ' a. m.' else ' p. m.' end
  from (select p_ts at time zone p_tz as l) x
$$;

-- p en centavos (appointment_items.price es bigint en centavos)
create or replace function public._usd(p numeric) returns text language sql immutable as $$
  select 'US$ ' || replace(to_char(coalesce(p, 0) / 100.0, 'FM999990.00'), '.', ',')
$$;

-- Cuerpo de cita (confirmation / reminder24 / reminder2).
create or replace function public._wa_cita_body(p_kind text, p_appt uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare a appointments; c clients; b businesses; m memberships; svc text; tot numeric; head text; lines text;
begin
  select * into a from appointments where id = p_appt;
  select * into c from clients where id = a.client_id;
  select * into b from businesses where id = a.business_id;
  select * into m from memberships where id = a.member_id;
  select string_agg(i.name, ' + ' order by i.name), sum(i.price) into svc, tot from appointment_items i where i.appointment_id = a.id;
  head := case p_kind
    when 'confirmation' then format(E'✅ *¡Cita confirmada, %s!*', split_part(trim(c.full_name), ' ', 1))
    when 'reminder24' then format(E'⏰ *Recordatorio:* %s, mañana tienes cita.', split_part(trim(c.full_name), ' ', 1))
    else format(E'⏰ *%s, tu cita es en 2 horas.*', split_part(trim(c.full_name), ' ', 1)) end;
  lines := format(E'💈 *%s*\n📅 %s', b.name, _fecha_es(a.starts_at, b.timezone))
    || case when svc is not null then format(E'\n✂️ %s · %s', svc, _usd(tot)) else '' end
    || format(E'\n👤 Con %s', m.display_name)
    || case when coalesce(b.address, '') <> '' then format(E'\n📍 %s', b.address) else '' end;
  return head || E'\n\n' || lines || E'\n\nVer o cancelar tu cita: {{BASE}}/c/' || a.short_token;
end $$;
revoke all on function public._wa_cita_body(text, uuid) from public, anon, authenticated;

create or replace function public._reactivation_body(c clients, b businesses, p_days int) returns text
language sql stable security definer set search_path = public as $$
  select format(E'💈 *%s*\n\nHola %s, ya pasaron %s días desde tu último corte. ¿Agendamos el próximo?\n\nReserva aquí: {{BASE}}/%s',
    b.name, split_part(trim(c.full_name), ' ', 1), p_days, b.slug)
$$;

create or replace function public.schedule_reminders(p_appt uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare a appointments; c clients;
begin
  select * into a from appointments where id = p_appt;
  if not found or a.client_id is null then return; end if;
  select * into c from clients where id = a.client_id;
  if not c.whatsapp_opt_in or c.phone is null then return; end if;
  insert into scheduled_messages(business_id, client_id, appointment_id, kind, to_phone, payload, send_at)
    select a.business_id, c.id, a.id, 'reminder', c.phone,
      jsonb_build_object('body', _wa_cita_body(case when h = interval '24 hours' then 'reminder24' else 'reminder2' end, a.id)), a.starts_at - h
    from unnest(array[interval '24 hours', interval '2 hours']) h
    where a.starts_at - h > now()
    on conflict do nothing;
end $function$;

CREATE OR REPLACE FUNCTION public.appointments_msg_sync()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
        format(E'❌ *Cita cancelada*\n\nHola %s, tu cita en *%s* del %s fue cancelada.\n\nSi quieres, reserva otra: {{BASE}}/%s',
          split_part(trim(c.full_name), ' ', 1), b.name, _fecha_es(new.starts_at, b.timezone), b.slug)), now())
      on conflict do nothing;
    end if;
  end if;
  if new.starts_at <> old.starts_at and new.status not in ('cancelled','no_show','completed') then
    perform public.schedule_reminders(new.id);
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.public_create_booking(p_slug text, p_member uuid, p_service_ids uuid[], p_starts_at timestamp with time zone, p_name text, p_phone text, p_opt_in boolean DEFAULT false, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b businesses; m memberships; q record; v_phone text; cid uuid; aid uuid; tok text; ends timestamptz; recent int;
begin
  select * into b from businesses where slug = p_slug;
  if not found then raise exception 'business_not_found'; end if;
  select * into m from memberships where id = p_member and business_id = b.id and is_bookable and active;
  if not found then raise exception 'barber_not_found'; end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(p_name) > 80 then raise exception 'invalid_name'; end if;
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
      values (b.id, cid, aid, 'confirmation', v_phone, jsonb_build_object('body', _wa_cita_body('confirmation', aid), 'media', 'og'), now())
      on conflict do nothing;
    perform schedule_reminders(aid);
  end if;
  return jsonb_build_object('appointment_id', aid, 'manage_token', tok, 'short_token', (select short_token from appointments where id = aid), 'starts_at', p_starts_at, 'ends_at', ends,
                            'member_name', m.display_name, 'total', q.total);
end $function$;

-- msg_claim: + short_token y media (para enviar la tarjeta como imagen).
drop function if exists public.msg_claim(text, int, uuid, uuid, text);
create or replace function public.msg_claim(p_secret text, p_limit int default 20, p_appointment uuid default null, p_id uuid default null, p_fallback_instance text default null)
returns table(id uuid, business_id uuid, kind text, to_phone text, body text, attempts int, instance_name text, to_email text, appointment_id uuid, short_token text, media text)
language plpgsql security definer set search_path = public as $$
begin
  if not _cron_ok(p_secret) then raise exception 'forbidden'; end if;
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
end $$;
grant execute on function public.msg_claim(text, int, uuid, uuid, text) to anon, authenticated;
