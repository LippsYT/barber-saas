-- Perfil del negocio (galería de trabajos y cambio de enlace), inventario/proveedores e informe semanal por email.

-- ── Galería de trabajos: aparece en la página pública de reservas ────────────
create table if not exists portfolio_images (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  url text not null check (char_length(url) <= 600 and url ~* '^https://'),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_images_biz on portfolio_images (business_id, sort_order);

-- ── Inventario ───────────────────────────────────────────────────────────────
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 40),
  email text check (email is null or char_length(email) <= 160),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);
-- `products` ya existe desde 0001 (name, sku, price, cost, active) con sus políticas prod_sel/prod_all: solo se amplía.
alter table products add column if not exists supplier_id uuid references suppliers(id) on delete set null;
alter table products add column if not exists category text check (category is null or char_length(category) <= 60);
alter table products add column if not exists stock integer not null default 0 check (stock >= 0);
alter table products add column if not exists min_stock integer not null default 0 check (min_stock >= 0);
alter table products add column if not exists created_at timestamptz not null default now();
create index if not exists products_biz on products (business_id, name);

alter table portfolio_images enable row level security;
alter table suppliers enable row level security;
drop policy if exists portfolio_sel on portfolio_images; drop policy if exists portfolio_all on portfolio_images;
drop policy if exists suppliers_sel on suppliers; drop policy if exists suppliers_all on suppliers;
create policy portfolio_sel on portfolio_images for select to authenticated using (is_member(business_id));
create policy portfolio_all on portfolio_images for all to authenticated
  using (has_role(business_id, 'owner', 'admin')) with check (has_role(business_id, 'owner', 'admin'));
create policy suppliers_sel on suppliers for select to authenticated using (has_role(business_id, 'owner', 'admin', 'receptionist'));
create policy suppliers_all on suppliers for all to authenticated
  using (has_role(business_id, 'owner', 'admin')) with check (has_role(business_id, 'owner', 'admin'));
revoke all on portfolio_images, suppliers from public, anon, authenticated;
grant select, insert, update, delete on portfolio_images, suppliers to authenticated;

-- ── Cambiar el enlace de reserva (solo el dueño) ─────────────────────────────
create or replace function public.change_business_slug(p_slug text) returns text
language plpgsql security definer set search_path = public as $$
declare bid uuid; s text := lower(trim(coalesce(p_slug, '')));
begin
  select m.business_id into bid from memberships m where m.user_id = auth.uid() and m.active and m.role = 'owner' limit 1;
  if bid is null then raise exception 'forbidden'; end if;
  if s !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(s) not between 3 and 40 then raise exception 'invalid_slug'; end if;
  if s in ('app','api','b','c','l','login','logout','signup','register','onboarding','auth','admin','dashboard','_next','static','img','images',
           'assets','public','cita','reservar','book','precios','pricing','terms','privacy','privacidad','terminos','help','ayuda','soporte','www','captura') then
    raise exception 'slug_taken';
  end if;
  begin
    update businesses set slug = s where id = bid;
  exception when unique_violation then
    raise exception 'slug_taken';
  end;
  return s;
end $$;
revoke all on function public.change_business_slug(text) from public, anon;
grant execute on function public.change_business_slug(text) to authenticated;

-- ── Catálogo público: añade la galería (mantiene horario y días especiales de 0024) ──
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
                                   'slot_step_min', coalesce((b.settings->>'slot_step_min')::int, 15),
                                   'hours', coalesce((select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'is_open', h.is_open,
                                                'start', to_char(h.start_time, 'HH24:MI'), 'end', to_char(h.end_time, 'HH24:MI'))
                                                order by h.weekday) from business_hours h where h.business_id = b.id), '[]'),
                                   'special_days', coalesce((select jsonb_agg(jsonb_build_object('on_date', d.on_date, 'closed', d.closed,
                                                'start', to_char(d.start_time, 'HH24:MI'), 'end', to_char(d.end_time, 'HH24:MI'), 'note', d.note)
                                                order by d.on_date) from special_days d
                                                where d.business_id = b.id and d.on_date >= (now() at time zone b.timezone)::date), '[]'),
                                   'gallery', coalesce((select jsonb_agg(g.url order by g.sort_order, g.created_at)
                                                from portfolio_images g where g.business_id = b.id), '[]')),
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

-- ── Informe semanal por email (lo llama el servidor con el secreto del worker) ─
create or replace function public.report_targets(p_secret text)
returns table(business_id uuid, name text, timezone text, currency text, owner_email text)
language plpgsql security definer set search_path = public as $$
begin
  if not _cron_ok(p_secret) then raise exception 'forbidden'; end if;
  return query
    select b.id, b.name, b.timezone, b.currency, u.email::text
    from businesses b
    join memberships m on m.business_id = b.id and m.role = 'owner' and m.active
    join auth.users u on u.id = m.user_id
    where coalesce((b.settings->>'weekly_report')::boolean, false) and u.email is not null;
end $$;

create or replace function public.report_data(p_secret text, p_business uuid, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare income bigint; tips bigint; spent bigint;
begin
  if not _cron_ok(p_secret) then raise exception 'forbidden'; end if;
  select coalesce(sum(direction * amount) filter (where type = 'sale_income'), 0),
         coalesce(sum(direction * amount) filter (where type = 'tip_income'), 0),
         coalesce(-sum(direction * amount) filter (where type in ('expense', 'cash_out')), 0)
    into income, tips, spent
  from ledger_entries
  where business_id = p_business and occurred_at >= p_from and occurred_at < p_to and account in ('cash', 'bank', 'card_clearing');
  return jsonb_build_object(
    'income', income, 'tips', tips, 'expenses', spent,
    'appointments', coalesce((select jsonb_object_agg(status, n) from (
        select status::text, count(*) n from appointments where business_id = p_business and starts_at >= p_from and starts_at < p_to group by status) s), '{}'),
    'new_clients', (select count(*) from clients where business_id = p_business and created_at >= p_from and created_at < p_to),
    'top_services', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'n', n, 'total', total) order by n desc, total desc) from (
        select i.name, count(*) n, coalesce(sum(i.price), 0) total
        from appointment_items i join appointments a on a.id = i.appointment_id
        where a.business_id = p_business and a.status = 'completed' and a.starts_at >= p_from and a.starts_at < p_to
        group by i.name order by count(*) desc, sum(i.price) desc limit 5) t), '[]'),
    'by_barber', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'n', n) order by n desc) from (
        select m.display_name name, count(*) n from appointments a join memberships m on m.id = a.member_id
        where a.business_id = p_business and a.status = 'completed' and a.starts_at >= p_from and a.starts_at < p_to
        group by m.display_name order by count(*) desc limit 5) t), '[]'));
end $$;
revoke all on function public.report_targets(text), public.report_data(text, uuid, timestamptz, timestamptz) from public;
grant execute on function public.report_targets(text), public.report_data(text, uuid, timestamptz, timestamptz) to anon, authenticated;
