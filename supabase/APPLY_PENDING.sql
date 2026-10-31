-- Pegar completo en Supabase > SQL editor y ejecutar UNA vez. Reúne 0020 + 0022 + 0023 (todas idempotentes salvo los UPDATE de 0020, que son seguros de repetir).

-- ===== 0020_canonical_base_url =====
-- 0020: la URL de los mensajes es la de producción.
-- Aplicar en el SQL editor de Supabase (o con supabase db push).
-- Los cuerpos nuevos siguen usando {{BASE}}; el sender lo cambia por APP_BASE_URL o por el alias de producción.
-- Aquí se corrige lo ya guardado (hosts *.vercel.app de preview/rama) y _app_base_url() para que el vault
-- no pueda devolver un deploy de preview.

create or replace function public._app_base_url() returns text
language plpgsql stable security definer set search_path = public, vault as $$
declare
  v text;
  canonical text := 'https://barber-saas-chi-five.vercel.app';
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
    'https://barber-saas-chi-five.vercel.app',
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
    E'\\1https://barber-saas-chi-five.vercel.app/',
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
     and position('https://barber-saas-chi-five.vercel.app' in cur) = 0 then
    perform vault.update_secret(sid, 'https://barber-saas-chi-five.vercel.app', 'app_base_url', 'Base pública de los links de WhatsApp');
  end if;
exception when others then
  raise notice 'vault app_base_url no actualizado: %', sqlerrm;
end $$;

-- ===== 0022_member_avatars =====
-- Foto de perfil por persona del equipo. Aparece en el link de reservas junto al nombre.
alter table memberships add column if not exists avatar_url text;

-- El catálogo público devuelve la foto de cada barbero.
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
                                   'slot_step_min', coalesce((b.settings->>'slot_step_min')::int, 15)),
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

-- Bucket público `avatars`: lectura para todos, subida solo de dueño/admin en la carpeta de su negocio.
-- En PGlite (tests) no existe storage: se omite.
do $body$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage no está en esta base: crea el bucket público avatars a mano';
    return;
  end if;
  begin
    insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
  exception when others then
    raise notice 'no se pudo crear el bucket avatars: %', sqlerrm;
  end;
  if to_regclass('storage.objects') is null then return; end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'avatars_public_read') then
    execute 'create policy avatars_public_read on storage.objects for select to public using (bucket_id = ''avatars'')';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'avatars_member_insert') then
    execute $p$create policy avatars_member_insert on storage.objects for insert to authenticated with check (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] in (
        select b.id::text from public.businesses b
        where public.is_member(b.id) and public.has_role(b.id, 'owner', 'admin')
      )
    )$p$;
  end if;
exception when others then
  raise notice 'políticas de storage omitidas: %', sqlerrm;
end
$body$;

-- ===== 0023_pulse_link =====
-- Pulse Link: página pública de enlaces del negocio (/l/<slug>) con bloques y métricas (visitas y clics).
create table if not exists link_pages (
  business_id uuid primary key references businesses(id) on delete cascade,
  enabled boolean not null default true,
  headline text,
  updated_at timestamptz not null default now()
);
create table if not exists link_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null check (kind in ('button', 'link', 'social', 'text', 'title', 'hours')),
  label text not null check (char_length(label) between 1 and 200),
  url text check (url is null or (char_length(url) <= 500 and url ~* '^(https?://|tel:|mailto:|/)')),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists link_blocks_biz on link_blocks (business_id, sort_order);
create table if not exists link_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null check (kind in ('view', 'click')),
  block_id uuid references link_blocks(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists link_events_biz on link_events (business_id, created_at);

alter table link_pages enable row level security;
alter table link_blocks enable row level security;
alter table link_events enable row level security;
drop policy if exists link_pages_sel on link_pages;
drop policy if exists link_pages_all on link_pages;
drop policy if exists link_blocks_sel on link_blocks;
drop policy if exists link_blocks_all on link_blocks;
drop policy if exists link_events_sel on link_events;
create policy link_pages_sel on link_pages for select to authenticated using (is_member(business_id));
create policy link_pages_all on link_pages for all to authenticated
  using (has_role(business_id, 'owner', 'admin')) with check (has_role(business_id, 'owner', 'admin'));
create policy link_blocks_sel on link_blocks for select to authenticated using (is_member(business_id));
create policy link_blocks_all on link_blocks for all to authenticated
  using (has_role(business_id, 'owner', 'admin')) with check (has_role(business_id, 'owner', 'admin'));
create policy link_events_sel on link_events for select to authenticated using (has_role(business_id, 'owner', 'admin'));
revoke all on link_pages, link_blocks, link_events from public, anon, authenticated;
grant select, insert, update, delete on link_pages, link_blocks to authenticated;
grant select on link_events to authenticated;
grant all on link_pages, link_blocks, link_events to service_role;

-- Lectura pública: nombre, portada, dirección, teléfono, titular y bloques activos. Todo negocio tiene Pulse Link.
create or replace function public.public_get_link_page(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b businesses; pg link_pages;
begin
  select * into b from businesses where slug = p_slug;
  if not found then return null; end if;
  select * into pg from link_pages where business_id = b.id;
  if found and not pg.enabled then return null; end if;
  return jsonb_build_object(
    'business', jsonb_build_object('name', b.name, 'slug', b.slug, 'cover_url', b.cover_url, 'address', b.address, 'phone', b.phone),
    'headline', pg.headline,
    'blocks', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'kind', k.kind, 'label', k.label, 'url', k.url) order by k.sort_order, k.created_at)
                        from link_blocks k where k.business_id = b.id and k.active), '[]'));
end $$;

-- Registro de visitas y clics (anónimo). Solo acepta bloques del propio negocio.
create or replace function public.public_track_link(p_slug text, p_kind text, p_block uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if p_kind not in ('view', 'click') then return; end if;
  select id into bid from businesses where slug = p_slug;
  if bid is null then return; end if;
  if p_block is not null and not exists (select 1 from link_blocks where id = p_block and business_id = bid) then p_block := null; end if;
  insert into link_events (business_id, kind, block_id) values (bid, p_kind, p_block);
end $$;
grant execute on function public.public_get_link_page(text), public.public_track_link(text, text, uuid) to anon, authenticated;
