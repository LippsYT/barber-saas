-- 0010: categoría y tipo de precio, portada, WhatsApp por código de emparejamiento, catálogo público.
-- La categoría y el tipo de precio de House Davidson salen 1:1 de book.weibook.co/house_davidson (2026-10-30).
-- 'Precio a partir de' → price_kind 'from'. El typo 'servicos adicionales' se conserva tal cual la fuente.

alter table services add column if not exists category text;
alter table services add column if not exists price_kind text not null default 'fixed';
alter table services drop constraint if exists services_price_kind_check;
alter table services add constraint services_price_kind_check check (price_kind in ('fixed', 'from'));

alter table businesses add column if not exists cover_url text;

-- Quita el teléfono que no está en la fuente y deja bloques de 10 min (blocks_of_hours_to_book).
update businesses set phone = null
  where slug = 'house-davidson' and phone = '0968467113';
update businesses set settings = jsonb_set(settings, '{slot_step_min}', '10')
  where slug = 'house-davidson' and coalesce(settings->>'slot_step_min', '15') in ('15', '10');

update services s set category = v.cat, price_kind = v.kind
from (values
  ('servicio premium','Barberia','fixed'),
  ('servicio vip','Barberia','fixed'),
  ('servicio oro','Barberia','fixed'),
  ('servicio plata','Barberia','fixed'),
  ('servicio platinium','Barberia','fixed'),
  ('servicio básico','Barberia','fixed'),
  ('Servicio juvenil','Barberia','fixed'),
  ('servicio kids','Barberia','fixed'),
  ('servicio barba platinium','Barberia','fixed'),
  ('servicio facial vip','servicos adicionales','fixed'),
  ('depilación nasal','servicos adicionales','from'),
  ('cubrimiento de canas','servicos adicionales','fixed'),
  ('servicio de cejas ','servicos adicionales','fixed'),
  ('servicio de uñas vip','spa de uñas','fixed'),
  ('Servicio uñas   Premium','spa de uñas','fixed'),
  ('servicio de pedicura premium','spa de uñas','fixed'),
  ('servicios de trenzas','Barberia','from'),
  ('servicio de ondulaciones permanente','Barberia','fixed'),
  ('servicios tinturados rayitos','Barberia','fixed'),
  ('servicio de tinturado ','Barberia','fixed')
) as v(name, cat, kind)
where s.business_id = (select id from businesses where slug = 'house-davidson')
  and s.name = v.name;

alter table businesses drop constraint if exists businesses_slug_not_reserved;
alter table businesses add constraint businesses_slug_not_reserved check (slug not in (
  'app','api','b','login','logout','signup','register','onboarding','auth','admin','dashboard','_next','static','img','images',
  'assets','public','cita','reservar','book','precios','pricing','terms','privacy','privacidad','terminos','help','ayuda','soporte','www','captura'));

-- Moneda por defecto USD (la columna ya lo es desde 0008; el parámetro de la función seguía en COP).
create or replace function public.create_business(p_name text, p_slug text, p_display_name text,
  p_timezone text default 'America/Bogota', p_currency text default 'USD', p_owner_bookable boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := require_auth(); bid uuid; s text := slugify(coalesce(nullif(p_slug,''), p_name));
begin
  if s = '' then raise exception 'invalid_slug'; end if;
  if exists(select 1 from businesses where slug = s) then raise exception 'slug_taken'; end if;
  insert into businesses(name, slug, timezone, currency) values (trim(p_name), s, p_timezone, p_currency) returning id into bid;
  insert into memberships(business_id, user_id, display_name, role, is_bookable)
    values (bid, uid, coalesce(nullif(trim(p_display_name),''), 'Dueño'), 'owner', p_owner_bookable);
  insert into expense_categories(business_id, name)
    select bid, n from unnest(array['Insumos','Arriendo','Servicios públicos','Nómina','Otros']) n;
  insert into commission_rules(business_id, item_type, kind, value, base) values
    (bid, 'service', 'percent', 50, 'net_of_discount'),
    (bid, 'product', 'percent', 10, 'gross'),
    (bid, 'tip', 'percent', 100, 'gross');
  return bid;
end $$;

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
        'id', m.id, 'name', m.display_name, 'slug', m.booking_slug,
        'weekdays', coalesce((select jsonb_agg(distinct w.weekday) from working_hours w where w.member_id = m.id), '[]'),
        'services', coalesce((select jsonb_agg(jsonb_build_object('service_id', ms.service_id,
              'price', coalesce(ms.price_override, s.price), 'duration_min', coalesce(ms.duration_override, s.duration_min)))
              from member_services ms join services s on s.id = ms.service_id and s.active where ms.member_id = m.id), '[]')
      ) order by m.display_name) from memberships m where m.business_id = b.id and m.is_bookable and m.active), '[]'));
end $$;

-- Vinculación WhatsApp (código de emparejamiento). Una fila por negocio.
create table if not exists whatsapp_links (
  business_id uuid primary key references businesses(id) on delete cascade,
  phone text,
  instance_name text not null,
  pairing_code text,
  status text not null default 'disconnected' check (status in ('disconnected', 'pairing', 'connected')),
  provider text not null check (provider in ('evolution', 'mock')),
  demo boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table whatsapp_links enable row level security;
drop policy if exists wa_sel on whatsapp_links;
drop policy if exists wa_all on whatsapp_links;
create policy wa_sel on whatsapp_links for select to authenticated using (is_member(business_id));
create policy wa_all on whatsapp_links for all to authenticated
  using (has_role(business_id, 'owner', 'admin'))
  with check (has_role(business_id, 'owner', 'admin'));
revoke all on whatsapp_links from public, anon, authenticated;
grant select, insert, update, delete on whatsapp_links to authenticated;
grant all on whatsapp_links to service_role;

-- Bucket de portadas. En PGlite (tests) no existe storage: se omite.
-- En Supabase crea el bucket público `covers`. Las políticas permiten leer a cualquiera
-- y subir solo al dueño/admin, en una carpeta con el id del negocio.
do $body$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage no está en esta base: crea el bucket público covers a mano si quieres subir portadas';
    return;
  end if;
  begin
    insert into storage.buckets (id, name, public) values ('covers', 'covers', true) on conflict (id) do nothing;
  exception when others then
    raise notice 'no se pudo crear el bucket covers: %', sqlerrm;
  end;
  if to_regclass('storage.objects') is null then return; end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'covers_public_read') then
    execute 'create policy covers_public_read on storage.objects for select to public using (bucket_id = ''covers'')';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'covers_member_insert') then
    execute $p$create policy covers_member_insert on storage.objects for insert to authenticated with check (
      bucket_id = 'covers'
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
