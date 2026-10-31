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
