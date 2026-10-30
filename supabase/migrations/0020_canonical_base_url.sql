-- 0020: la URL de los mensajes es la de producción.
-- No aplica este archivo sola: hay que correrlo en Supabase (no se aplicó en este cambio).
-- Los cuerpos nuevos siguen usando {{BASE}}; el sender lo cambia por APP_BASE_URL o por el alias de producción.
-- Aquí se corrige lo ya guardado (hosts *.vercel.app de preview/rama) y _app_base_url() para que el vault
-- no pueda devolver un deploy de preview.

create or replace function public._app_base_url() returns text
language plpgsql stable security definer set search_path = public, vault as $$
declare
  v text;
  canonical text := 'https://barber-saas-lippsyts-projects.vercel.app';
begin
  select rtrim(decrypted_secret, '/') into v
  from vault.decrypted_secrets where name = 'app_base_url' limit 1;
  if v is null or v = '' then
    return canonical;
  end if;
  if v ~* 'barber-saas[a-z0-9.-]*\.vercel\.app' and position(canonical in v) = 0 then
    return canonical;
  end if;
  return v;
end $$;
revoke all on function public._app_base_url() from public, anon, authenticated;

-- Cuerpos pendientes que ya traen un host de Vercel (preview, rama o deploy) → alias de producción.
update scheduled_messages
set payload = jsonb_set(
  payload,
  '{body}',
  to_jsonb(regexp_replace(
    payload->>'body',
    'https?://barber-saas[a-zA-Z0-9.-]*\.vercel\.app',
    'https://barber-saas-lippsyts-projects.vercel.app',
    'gi'
  ))
)
where status in ('pending', 'sending')
  and coalesce(payload->>'body', '') ~* 'https?://barber-saas[a-zA-Z0-9.-]*\.vercel\.app';

-- Links relativos que quedaron cuando el vault estaba vacío ("reserva otra: /slug").
update scheduled_messages
set payload = jsonb_set(
  payload,
  '{body}',
  to_jsonb(regexp_replace(
    payload->>'body',
    '((aquí|acá|otra):[[:space:]]*)/',
    E'\\1https://barber-saas-lippsyts-projects.vercel.app/',
    'gi'
  ))
)
where status in ('pending', 'sending')
  and coalesce(payload->>'body', '') ~* '(aquí|acá|otra):[[:space:]]*/[^/]';

-- Si el secreto app_base_url del vault es un host de preview, pasarlo al alias de producción.
-- En el harness de tests no existe vault.update_secret: este bloque no hace nada.
do $$
declare sid uuid; cur text;
begin
  if to_regprocedure('vault.update_secret(uuid,text,text,text)') is null then
    return;
  end if;
  select id, rtrim(decrypted_secret, '/') into sid, cur
  from vault.decrypted_secrets where name = 'app_base_url' limit 1;
  if sid is not null
     and cur ~* 'barber-saas[a-z0-9.-]*\.vercel\.app'
     and position('https://barber-saas-lippsyts-projects.vercel.app' in cur) = 0 then
    perform vault.update_secret(sid, 'https://barber-saas-lippsyts-projects.vercel.app', 'app_base_url', 'Base pública de los links de WhatsApp');
  end if;
exception when others then
  raise notice 'vault app_base_url no actualizado: %', sqlerrm;
end $$;
