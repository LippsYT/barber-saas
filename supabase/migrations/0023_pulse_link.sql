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
