-- 0008: moneda única USD (montos en centavos), descripción/orden de servicios, slugs reservados para URL corta /<slug>
alter table businesses alter column currency set default 'USD';
update businesses set currency = 'USD' where currency <> 'USD';

alter table services add column if not exists description text;
alter table services add column if not exists sort_order integer not null default 0;

-- /<slug> vive en la raíz: el slug no puede chocar con rutas de la app
alter table businesses drop constraint if exists businesses_slug_not_reserved;
alter table businesses add constraint businesses_slug_not_reserved check (slug not in (
  'app','api','b','login','logout','signup','register','onboarding','auth','admin','dashboard','_next','static','img','images',
  'assets','public','cita','reservar','book','precios','pricing','terms','privacy','privacidad','terminos','help','ayuda','soporte','www'));

create or replace function public.public_get_catalog(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b businesses;
begin
  select * into b from businesses where slug = p_slug;
  if not found then return null; end if;
  return jsonb_build_object(
    'business', jsonb_build_object('name', b.name, 'slug', b.slug, 'timezone', b.timezone, 'currency', b.currency,
                                   'phone', b.phone, 'address', b.address,
                                   'max_advance_days', coalesce((b.settings->>'max_advance_days')::int, 30)),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'description', s.description,
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
