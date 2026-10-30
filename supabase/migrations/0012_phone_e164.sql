-- 0012: teléfonos de clientes en E.164 (+593 por defecto, configurable por negocio).
alter table businesses add column if not exists phone_country_code text not null default '593'
  check (phone_country_code ~ '^[1-9][0-9]{0,2}$');

-- Misma regla que src/lib/phone.ts (toE164).
create or replace function public.normalize_phone(p text, cc text default '593')
returns text language plpgsql immutable set search_path = public as $$
declare s text := btrim(coalesce(p, '')); d text; c text := coalesce(nullif(cc, ''), '593');
begin
  d := regexp_replace(s, '[^0-9]', '', 'g');
  if d = '' then return null; end if;
  if left(s, 1) = '+' then return '+' || d; end if;
  if left(d, 2) = '00' then return '+' || substr(d, 3); end if;
  if left(d, 1) = '0' then return '+' || c || ltrim(d, '0'); end if;
  -- 11+ dígitos sin + ni 0: ya trae código de país (ej. 593991234567, 5491157604074).
  if length(d) >= 11 then return '+' || d; end if;
  return '+' || c || d;
end $$;

create or replace function public._clients_normalize_phone() returns trigger
language plpgsql set search_path = public as $$
begin
  new.phone := normalize_phone(new.phone, (select phone_country_code from businesses where id = new.business_id));
  return new;
end $$;
drop trigger if exists clients_normalize_phone on clients;
create trigger clients_normalize_phone before insert or update of phone on clients
  for each row execute function _clients_normalize_phone();

-- Normaliza los existentes, salvo que choque con otro cliente del mismo negocio.
update clients c set phone = normalize_phone(c.phone, b.phone_country_code)
from businesses b
where b.id = c.business_id and c.phone is not null
  and c.phone is distinct from normalize_phone(c.phone, b.phone_country_code)
  and not exists (select 1 from clients o where o.business_id = c.business_id and o.id <> c.id
                  and o.phone = normalize_phone(c.phone, b.phone_country_code));

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
               to_char(p_starts_at at time zone b.timezone, 'DD/MM "a las" HH24:MI'), b.slug, tok)), now());
    perform schedule_reminders(aid);
  end if;
  return jsonb_build_object('appointment_id', aid, 'manage_token', tok, 'starts_at', p_starts_at, 'ends_at', ends,
                            'member_name', m.display_name, 'total', q.total);
end $$;

