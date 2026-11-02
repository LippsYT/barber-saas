-- El envío de WhatsApp también exige el complemento al momento de enviar, no solo al programar.
-- Antes: si un negocio quitaba WhatsApp (o su plan se vencía) con mensajes ya programados, esos salían igual.
-- Ahora: lo pendiente de un negocio sin el complemento se descarta como 'skipped' (error addon_required) y no se envía.
CREATE OR REPLACE FUNCTION public.msg_claim(p_secret text, p_limit integer DEFAULT 20, p_appointment uuid DEFAULT NULL::uuid, p_id uuid DEFAULT NULL::uuid, p_fallback_instance text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, business_id uuid, kind text, to_phone text, body text, attempts integer, instance_name text, to_email text, appointment_id uuid, short_token text, media text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not _cron_ok(p_secret, 'messages') then raise exception 'forbidden'; end if;
  update scheduled_messages s set status = 'pending' where s.status = 'sending' and s.claimed_at < now() - interval '10 minutes';
  update scheduled_messages s set status = 'skipped', error = 'addon_required'
    where s.status = 'pending' and s.send_at <= now() and s.channel = 'whatsapp' and not _biz_has(s.business_id, 'whatsapp');
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
