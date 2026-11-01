-- El pedido de reseña es del complemento "resenas" (Reseñas en Google), además de WhatsApp. Resto igual que 0029.
create or replace function public._msg_on(p_bid uuid, p_key text, p_default boolean default true) returns boolean
language sql stable security definer set search_path = public as $$
  select _biz_has(p_bid, 'whatsapp') and (p_key <> 'review' or _biz_has(p_bid, 'resenas'))
         and coalesce((select (settings->'messages'->>p_key)::boolean from businesses where id = p_bid), p_default)
$$;
revoke all on function public._msg_on(uuid, text, boolean) from public, anon, authenticated;
