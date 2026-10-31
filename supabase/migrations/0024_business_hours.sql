-- Horario del negocio por día + días especiales. Limita la disponibilidad real de la página de reservas.
-- Sin filas el comportamiento no cambia: solo cuentan las horas de cada barbero (working_hours).
create table if not exists business_hours (
  business_id uuid not null references businesses(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0 = domingo (igual que working_hours)
  is_open boolean not null default true,
  start_time time not null default '09:00',
  end_time time not null default '19:00',
  primary key (business_id, weekday),
  check (end_time > start_time)
);
create table if not exists special_days (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  on_date date not null,
  closed boolean not null default true,
  start_time time,
  end_time time,
  note text check (note is null or char_length(note) <= 120),
  unique (business_id, on_date),
  check (closed or (start_time is not null and end_time is not null and end_time > start_time))
);

alter table business_hours enable row level security;
alter table special_days enable row level security;
drop policy if exists business_hours_sel on business_hours;
drop policy if exists business_hours_all on business_hours;
drop policy if exists special_days_sel on special_days;
drop policy if exists special_days_all on special_days;
create policy business_hours_sel on business_hours for select to authenticated using (is_member(business_id));
create policy business_hours_all on business_hours for all to authenticated
  using (has_role(business_id, 'owner', 'admin')) with check (has_role(business_id, 'owner', 'admin'));
create policy special_days_sel on special_days for select to authenticated using (is_member(business_id));
create policy special_days_all on special_days for all to authenticated
  using (has_role(business_id, 'owner', 'admin')) with check (has_role(business_id, 'owner', 'admin'));
revoke all on business_hours, special_days from public, anon, authenticated;
grant select, insert, update, delete on business_hours, special_days to authenticated;

-- Misma lógica de 0004, recortada por el horario del negocio (o por el día especial, que manda).
create or replace function public._member_slots(p_bid uuid, p_member uuid, p_date date, p_duration integer)
returns table(slot_start timestamptz, slot_end timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare b businesses; step int; notice int; adv int; w record; t timestamptz; wend timestamptz;
        sd special_days; bh business_hours; lo time; hi time;
begin
  select * into b from businesses where id = p_bid;
  step := greatest(coalesce((b.settings->>'slot_step_min')::int, 15), 5);
  notice := coalesce((b.settings->>'min_notice_min')::int, 60);
  adv := coalesce((b.settings->>'max_advance_days')::int, 30);
  select * into sd from special_days where business_id = p_bid and on_date = p_date;
  if found then
    if sd.closed then return; end if;
    lo := sd.start_time; hi := sd.end_time;
  else
    select * into bh from business_hours where business_id = p_bid and weekday = extract(dow from p_date)::int;
    if found then
      if not bh.is_open then return; end if;
      lo := bh.start_time; hi := bh.end_time;
    end if;
  end if;
  for w in select start_time, end_time from working_hours
           where member_id = p_member and weekday = extract(dow from p_date)::int order by start_time loop
    t := (p_date + greatest(w.start_time, coalesce(lo, w.start_time))) at time zone b.timezone;
    wend := (p_date + least(w.end_time, coalesce(hi, w.end_time))) at time zone b.timezone;
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

-- El catálogo público añade el horario y los próximos días especiales (para la portada de reservas).
create or replace function public.public_get_catalog(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b businesses;
begin
  select * into b from businesses where slug = p_slug;
  if not found then return null; end if;
  return jsonb_build_object(
    'business', jsonb_build_object('name', b.name, 'slug', b.slug, 'timezone', b.timezone, 'currency', b.currency,
                                   'phone', b.phone, 'address', b.address, 'cover_url', b.cover_url,
                                   'max_advance_days', coalesce((b.settings->>'max_advance_days')::int, 30),
                                   'slot_step_min', coalesce((b.settings->>'slot_step_min')::int, 15),
                                   'hours', coalesce((select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'is_open', h.is_open,
                                                'start', to_char(h.start_time, 'HH24:MI'), 'end', to_char(h.end_time, 'HH24:MI'))
                                                order by h.weekday) from business_hours h where h.business_id = b.id), '[]'),
                                   'special_days', coalesce((select jsonb_agg(jsonb_build_object('on_date', d.on_date, 'closed', d.closed,
                                                'start', to_char(d.start_time, 'HH24:MI'), 'end', to_char(d.end_time, 'HH24:MI'), 'note', d.note)
                                                order by d.on_date) from special_days d
                                                where d.business_id = b.id and d.on_date >= (now() at time zone b.timezone)::date), '[]')),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'description', s.description,
                          'category', s.category, 'price_kind', s.price_kind,
                          'duration_min', s.duration_min, 'price', s.price)
                          order by s.sort_order, s.name) from services s where s.business_id = b.id and s.active), '[]'),
    'barbers', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'name', m.display_name, 'slug', m.booking_slug, 'avatar_url', m.avatar_url,
        'weekdays', coalesce((select jsonb_agg(distinct w.weekday) from working_hours w where w.member_id = m.id), '[]'),
        'services', coalesce((select jsonb_agg(jsonb_build_object('service_id', ms.service_id,
              'price', coalesce(ms.price_override, s.price), 'duration_min', coalesce(ms.duration_override, s.duration_min)))
              from member_services ms join services s on s.id = ms.service_id and s.active where ms.member_id = m.id), '[]')
      ) order by m.display_name) from memberships m where m.business_id = b.id and m.is_bookable and m.active), '[]'));
end $$;
