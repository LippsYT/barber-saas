-- Ajustes del negocio (reglas de reserva y mensajes automáticos) con validación en el servidor.
-- businesses.settings: min_notice_min, max_advance_days, slot_step_min, cancel_notice_min, time_format, weekly_report, review_url,
--   messages {confirmation, reminder24, reminder2, cancellation, review} (bool), messages_text {confirmation, reminder24, reminder2} (texto).

create or replace function public._msg_on(p_bid uuid, p_key text, p_default boolean default true) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (settings->'messages'->>p_key)::boolean from businesses where id = p_bid), p_default)
$$;
revoke all on function public._msg_on(uuid, text, boolean) from public, anon, authenticated;

create or replace function public.set_business_settings(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare bid uuid; k text; v jsonb; cur jsonb; out jsonb; t text; mk text;
begin
  select m.business_id into bid from memberships m where m.user_id = auth.uid() and m.active and m.role in ('owner','admin') limit 1;
  if bid is null then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'bad_setting'; end if;
  select coalesce(settings, '{}'::jsonb) into cur from businesses where id = bid;
  for k, v in select * from jsonb_each(p_patch) loop
    if k in ('min_notice_min', 'cancel_notice_min') then
      if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric not between 0 and 10080 or (v #>> '{}')::numeric <> floor((v #>> '{}')::numeric) then raise exception 'bad_setting'; end if;
      cur := cur || jsonb_build_object(k, v);
    elsif k = 'max_advance_days' then
      if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric not between 1 and 365 or (v #>> '{}')::numeric <> floor((v #>> '{}')::numeric) then raise exception 'bad_setting'; end if;
      cur := cur || jsonb_build_object(k, v);
    elsif k = 'slot_step_min' then
      if jsonb_typeof(v) <> 'number' or (v #>> '{}')::int not in (5, 10, 15, 20, 30, 45, 60) then raise exception 'bad_setting'; end if;
      cur := cur || jsonb_build_object(k, v);
    elsif k = 'time_format' then
      if v #>> '{}' not in ('12', '24') then raise exception 'bad_setting'; end if;
      cur := cur || jsonb_build_object(k, v);
    elsif k = 'weekly_report' then
      if jsonb_typeof(v) <> 'boolean' then raise exception 'bad_setting'; end if;
      cur := cur || jsonb_build_object(k, v);
    elsif k = 'review_url' then
      t := coalesce(v #>> '{}', '');
      if t <> '' and (char_length(t) > 300 or t !~* '^https://') then raise exception 'bad_setting'; end if;
      cur := cur || jsonb_build_object(k, t);
    elsif k = 'messages' then
      if jsonb_typeof(v) <> 'object' then raise exception 'bad_setting'; end if;
      for mk, out in select * from jsonb_each(v) loop
        if mk not in ('confirmation', 'reminder24', 'reminder2', 'cancellation', 'review') or jsonb_typeof(out) <> 'boolean' then raise exception 'bad_setting'; end if;
      end loop;
      cur := cur || jsonb_build_object('messages', coalesce(cur->'messages', '{}'::jsonb) || v);
    elsif k = 'messages_text' then
      if jsonb_typeof(v) <> 'object' then raise exception 'bad_setting'; end if;
      for mk, out in select * from jsonb_each(v) loop
        if mk not in ('confirmation', 'reminder24', 'reminder2') or jsonb_typeof(out) not in ('string', 'null') or char_length(coalesce(out #>> '{}', '')) > 600 then raise exception 'bad_setting'; end if;
      end loop;
      cur := cur || jsonb_build_object('messages_text', coalesce(cur->'messages_text', '{}'::jsonb) || v);
    elsif k = 'payment_methods' then
      if jsonb_typeof(v) <> 'object' then raise exception 'bad_setting'; end if;
      for mk, out in select * from jsonb_each(v) loop
        if mk not in ('cash', 'card', 'transfer', 'other') or jsonb_typeof(out) <> 'boolean' then raise exception 'bad_setting'; end if;
      end loop;
      cur := cur || jsonb_build_object('payment_methods', coalesce(cur->'payment_methods', '{}'::jsonb) || v);
      -- siempre debe quedar al menos un método para cobrar
      if not exists (select 1 from unnest(array['cash', 'card', 'transfer', 'other']) x where coalesce((cur->'payment_methods'->>x)::boolean, true)) then
        raise exception 'bad_setting';
      end if;
    else
      raise exception 'bad_setting';
    end if;
  end loop;
  update businesses set settings = cur where id = bid;
  return cur;
end $$;
revoke all on function public.set_business_settings(jsonb) from public, anon;
grant execute on function public.set_business_settings(jsonb) to authenticated;

-- Cuerpo de cita (confirmation / reminder24 / reminder2). Si el negocio escribió su texto, se usa con los campos dinámicos:
-- @nombre_cliente @nombre_del_negocio @fecha_reserva @barbero @servicios @total. El enlace para ver o cancelar siempre se añade.
create or replace function public._wa_cita_body(p_kind text, p_appt uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare a appointments; c clients; b businesses; m memberships; svc text; tot numeric; head text; lines text; custom text; first text;
begin
  select * into a from appointments where id = p_appt;
  select * into c from clients where id = a.client_id;
  select * into b from businesses where id = a.business_id;
  select * into m from memberships where id = a.member_id;
  select string_agg(i.name, ' + ' order by i.name), sum(i.price) into svc, tot from appointment_items i where i.appointment_id = a.id;
  first := split_part(trim(c.full_name), ' ', 1);
  custom := nullif(trim(coalesce(b.settings->'messages_text'->>p_kind, '')), '');
  if custom is not null then
    custom := replace(custom, '@nombre_cliente', first);
    custom := replace(custom, '@nombre_del_negocio', b.name);
    custom := replace(custom, '@fecha_reserva', _fecha_es(a.starts_at, b.timezone));
    custom := replace(custom, '@barbero', m.display_name);
    custom := replace(custom, '@servicios', coalesce(svc, ''));
    custom := replace(custom, '@total', _usd(tot));
    return custom || E'\n\nVer o cancelar tu cita: {{BASE}}/c/' || a.short_token;
  end if;
  head := case p_kind
    when 'confirmation' then format(E'✅ *¡Cita confirmada, %s!*', first)
    when 'reminder24' then format(E'⏰ *Recordatorio:* %s, mañana tienes cita.', first)
    else format(E'⏰ *%s, tu cita es en 2 horas.*', first) end;
  lines := format(E'💈 *%s*\n📅 %s', b.name, _fecha_es(a.starts_at, b.timezone))
    || case when svc is not null then format(E'\n✂️ %s · %s', svc, _usd(tot)) else '' end
    || format(E'\n👤 Con %s', m.display_name)
    || case when coalesce(b.address, '') <> '' then format(E'\n📍 %s', b.address) else '' end;
  return head || E'\n\n' || lines || E'\n\nVer o cancelar tu cita: {{BASE}}/c/' || a.short_token;
end $$;
revoke all on function public._wa_cita_body(text, uuid) from public, anon, authenticated;

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
      and _msg_on(a.business_id, case when h = interval '24 hours' then 'reminder24' else 'reminder2' end)
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
    if c.whatsapp_opt_in and c.phone is not null and _msg_on(new.business_id, 'cancellation') then
      insert into scheduled_messages(business_id, client_id, appointment_id, kind, to_phone, payload, send_at)
      values (new.business_id, c.id, new.id, 'cancellation', c.phone, jsonb_build_object('body',
        format(E'❌ *Cita cancelada*\n\nHola %s, tu cita en *%s* del %s fue cancelada.\n\nSi quieres, reserva otra: {{BASE}}/%s',
          split_part(trim(c.full_name), ' ', 1), b.name, _fecha_es(new.starts_at, b.timezone), b.slug)), now())
      on conflict do nothing;
    end if;
  end if;
  if new.status = 'completed' and old.status <> 'completed' and new.client_id is not null then
    select * into c from clients where id = new.client_id;
    select * into b from businesses where id = new.business_id;
    if c.whatsapp_opt_in and c.phone is not null and _msg_on(new.business_id, 'review', false) and coalesce(b.settings->>'review_url', '') <> ''
       and not exists (select 1 from scheduled_messages s where s.appointment_id = new.id and s.kind = 'review') then
      insert into scheduled_messages(business_id, client_id, appointment_id, kind, to_phone, payload, send_at)
      values (new.business_id, c.id, new.id, 'review', c.phone, jsonb_build_object('body',
        format(E'⭐ *%s*\n\nHola %s, ¡gracias por visitarnos! ¿Nos cuentas cómo te fue? Déjanos tu reseña aquí: %s',
          b.name, split_part(trim(c.full_name), ' ', 1), b.settings->>'review_url')), now() + interval '2 hours');
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

-- El cliente solo puede cancelar con la antelación mínima que fije el negocio (cancel_notice_min, 0 = sin límite).
create or replace function public.public_cancel_booking(p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare a appointments; notice int;
begin
  select * into a from appointments where manage_token = p_token and status in ('reserved','confirmed') and starts_at > now();
  if not found then return false; end if;
  select coalesce((settings->>'cancel_notice_min')::int, 0) into notice from businesses where id = a.business_id;
  if a.starts_at < now() + make_interval(mins => notice) then raise exception 'cancel_too_late'; end if;
  update appointments set status = 'cancelled', cancel_reason = 'Cancelada por el cliente' where id = a.id;
  return true;
end $$;
