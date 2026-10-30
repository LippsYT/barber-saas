-- 0017: msg_claim devuelve email del cliente y acepta instancia de respaldo (solo preview, env WHATSAPP_FALLBACK_INSTANCE).
drop function if exists public.msg_claim(text, int, uuid, uuid);
create or replace function public.msg_claim(p_secret text, p_limit int default 20, p_appointment uuid default null, p_id uuid default null, p_fallback_instance text default null)
returns table(id uuid, business_id uuid, kind text, to_phone text, body text, attempts int, instance_name text, to_email text, appointment_id uuid)
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
    returning s.id, s.business_id, s.kind, s.to_phone, s.payload->>'body' as body, s.attempts, s.client_id, s.appointment_id
  )
  select u.id, u.business_id, u.kind, u.to_phone, u.body, u.attempts,
         coalesce((select w.instance_name from whatsapp_links w where w.business_id = u.business_id and w.status = 'connected' and not w.demo), nullif(p_fallback_instance, '')),
         (select cl.email from clients cl where cl.id = u.client_id), u.appointment_id
  from u;
end $$;
grant execute on function public.msg_claim(text, int, uuid, uuid, text) to anon, authenticated;

-- Para el envío inmediato desde la página pública de la cita (solo con el token).
create or replace function public.public_appointment_id(p_token text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from appointments where manage_token = p_token
$$;
grant execute on function public.public_appointment_id(text) to anon, authenticated;

-- Datos para .ics / email (público por token).
create or replace function public.public_booking_calendar(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', a.id, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'status', a.status,
    'business_name', b.name, 'address', b.address, 'slug', b.slug, 'timezone', b.timezone, 'member_name', m.display_name)
  from appointments a join businesses b on b.id = a.business_id join memberships m on m.id = a.member_id
  where a.manage_token = p_token
$$;
grant execute on function public.public_booking_calendar(text) to anon, authenticated;
