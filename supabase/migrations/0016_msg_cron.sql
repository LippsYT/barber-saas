-- 0016: pg_cron + pg_net. El worker HTTP se llama cada 3 min; la URL y el bypass vienen de vault.
-- Secretos en vault: cron_secret, app_base_url, cron_target_url, vercel_bypass (opcional).
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public._kick_sender() returns bigint
language plpgsql security definer set search_path = public, vault, net as $$
declare u text; s text; byp text; h jsonb;
begin
  select decrypted_secret into u from vault.decrypted_secrets where name = 'cron_target_url';
  select decrypted_secret into s from vault.decrypted_secrets where name = 'cron_secret';
  select decrypted_secret into byp from vault.decrypted_secrets where name = 'vercel_bypass';
  if u is null or s is null then return null; end if;
  if not exists (select 1 from scheduled_messages where status = 'pending' and send_at <= now()) then return 0; end if;
  h := jsonb_build_object('Authorization', 'Bearer ' || s, 'Content-Type', 'application/json');
  if byp is not null then h := h || jsonb_build_object('x-vercel-protection-bypass', byp); end if;
  return net.http_post(url := u, headers := h, body := '{}'::jsonb, timeout_milliseconds := 30000);
end $$;
revoke all on function public._kick_sender() from public, anon, authenticated;

select cron.schedule('send-messages', '*/3 * * * *', 'select public._kick_sender()');
select cron.schedule('enqueue-reactivations', '0 13 * * *', 'select public.enqueue_reactivations()');
