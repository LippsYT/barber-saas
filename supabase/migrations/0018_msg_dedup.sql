-- 0018: evita mensajes duplicados en cola por cita.
-- confirmation/cancellation: uno vivo por (cita, kind, canal).
-- reminder: uno vivo por (cita, canal, send_at) => 24h y 2h siguen permitidos.
-- Filas cancelled/failed/skipped no cuentan (historial intacto; reprogramar re-encola).
-- reactivation/custom no tienen appointment_id: quedan fuera del índice.

-- 1) Resolver duplicados existentes: dejar la fila más "avanzada" (sent > sending > pending), cancelar pendientes extra.
with ranked as (
  select id, status, row_number() over (
    partition by appointment_id, channel, kind, case when kind = 'reminder' then send_at end
    order by case status::text when 'sent' then 0 when 'sending' then 1 else 2 end, created_at, id) rn
  from scheduled_messages
  where appointment_id is not null and kind in ('confirmation','cancellation','reminder')
    and status::text not in ('cancelled','failed','skipped')
)
update scheduled_messages m set status = 'cancelled', error = 'dedup_0018'
from ranked r where r.id = m.id and r.rn > 1 and m.status = 'pending';

create unique index if not exists scheduled_messages_uniq_appt_kind
  on scheduled_messages(appointment_id, channel, kind)
  where appointment_id is not null and kind in ('confirmation','cancellation')
    and status in ('pending','sending','sent');

create unique index if not exists scheduled_messages_uniq_appt_reminder
  on scheduled_messages(appointment_id, channel, send_at)
  where appointment_id is not null and kind = 'reminder'
    and status in ('pending','sending','sent');

-- 2) Encolado idempotente.
CREATE OR REPLACE FUNCTION public.appointments_msg_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
        format('Hola %s, tu cita en %s del %s fue cancelada. Si quieres, reserva otra: %s', c.full_name, b.name,
          to_char(new.starts_at at time zone b.timezone, 'DD/MM "a las" HH24:MI'),
          case when _app_base_url() <> '' then _app_base_url() || '/' || b.slug else '/' || b.slug end)), now())
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
      values (b.id, cid, aid, 'confirmation', v_phone, jsonb_build_object('body',
        format('¡Listo %s! Tu cita en %s con %s es el %s. Para cancelar: /b/%s/cita/%s', trim(p_name), b.name, m.display_name,
               to_char(p_starts_at at time zone b.timezone, 'DD/MM "a las" HH24:MI'), b.slug, tok)), now())
      on conflict do nothing;
    perform schedule_reminders(aid);
  end if;
  return jsonb_build_object('appointment_id', aid, 'manage_token', tok, 'starts_at', p_starts_at, 'ends_at', ends,
                            'member_name', m.display_name, 'total', q.total);
end $function$;
CREATE OR REPLACE FUNCTION public.schedule_reminders(p_appt uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    where a.starts_at - h > now()
    on conflict do nothing;
end $function$;
