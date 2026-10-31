-- Bloqueo por falta de pago. Un negocio puede usar Pulso si: está exento, está en prueba (14 días desde su alta),
-- o su suscripción de Stripe está activa / en prueba / con pago pendiente (Stripe reintenta el cobro unos días).
alter table businesses add column if not exists trial_ends_at timestamptz;
alter table businesses add column if not exists billing_exempt boolean not null default false;
-- Los negocios que ya existen estrenan 14 días desde hoy: nadie queda bloqueado de golpe.
update businesses set trial_ends_at = now() + interval '14 days' where trial_ends_at is null;
alter table businesses alter column trial_ends_at set default (now() + interval '14 days');
alter table businesses alter column trial_ends_at set not null;

-- Ni el dueño ni nadie desde la app puede darse prueba infinita o exención: solo el servidor / el SQL editor.
create or replace function public._guard_billing_columns() returns trigger
language plpgsql as $$
begin
  if (new.trial_ends_at is distinct from old.trial_ends_at or new.billing_exempt is distinct from old.billing_exempt)
     and current_user in ('authenticated', 'anon') then
    raise exception 'forbidden';
  end if;
  return new;
end $$;
drop trigger if exists businesses_guard_billing on businesses;
create trigger businesses_guard_billing before update on businesses for each row execute function public._guard_billing_columns();

create or replace function public._biz_active(p_bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select b.billing_exempt or b.trial_ends_at > now()
           or coalesce((select s.status in ('active', 'trialing', 'past_due') from subscriptions s where s.business_id = b.id), false)
    from businesses b where b.id = p_bid), false)
$$;
revoke all on function public._biz_active(uuid) from public, anon, authenticated;

-- Estado de acceso del negocio del usuario (lo lee el layout de la app).
create or replace function public.my_billing() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare bid uuid; b businesses; s subscriptions;
begin
  select m.business_id into bid from memberships m where m.user_id = auth.uid() and m.active limit 1;
  if bid is null then return null; end if;
  select * into b from businesses where id = bid;
  select * into s from subscriptions where business_id = bid;
  return jsonb_build_object('active', _biz_active(bid), 'exempt', b.billing_exempt, 'trial_ends_at', b.trial_ends_at,
                            'status', coalesce(s.status, 'none'), 'period_end', s.current_period_end);
end $$;
revoke all on function public.my_billing() from public, anon;
grant execute on function public.my_billing() to authenticated;

-- Sin acceso no se ofrecen horarios: la página de reservas deja de aceptar citas. Resto igual que 0024.
create or replace function public._member_slots(p_bid uuid, p_member uuid, p_date date, p_duration integer)
returns table(slot_start timestamptz, slot_end timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare b businesses; step int; notice int; adv int; w record; t timestamptz; wend timestamptz;
        sd special_days; bh business_hours; lo time; hi time;
begin
  if not _biz_active(p_bid) then return; end if;
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
