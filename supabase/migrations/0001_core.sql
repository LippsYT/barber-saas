-- 0001_core: negocios, membresías, helpers RLS, horarios, servicios, clientes, citas
create extension if not exists btree_gist;

create type member_role as enum ('owner','admin','receptionist','barber');
create type pay_type as enum ('commission','fixed','mixed');
create type pay_period as enum ('weekly','biweekly','monthly');
create type appointment_status as enum ('reserved','confirmed','in_progress','completed','no_show','cancelled');
create type appointment_source as enum ('admin','booking_link','whatsapp');

create or replace function public.slugify(t text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(translate(coalesce(t,''),
    'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')), '[^a-z0-9]+', '-', 'g'))
$$;

create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  timezone text not null default 'America/Bogota',
  currency text not null default 'COP',
  country text not null default 'CO',
  phone text,
  address text,
  -- booking: slot_step_min, min_notice_min, max_advance_days
  settings jsonb not null default '{"slot_step_min":15,"min_notice_min":60,"max_advance_days":30}'::jsonb,
  sale_seq integer not null default 0,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, -- null = barbero sin cuenta / invitación pendiente
  invited_email text,
  display_name text not null,
  role member_role not null,
  booking_slug text,
  is_bookable boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, user_id),
  unique (business_id, booking_slug)
);
create index on memberships(user_id) where active;

-- Datos de pago separados para que recepción/barberos no vean sueldos ajenos.
create table member_compensation (
  member_id uuid primary key references memberships(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  pay_type pay_type not null default 'commission',
  fixed_salary bigint not null default 0 check (fixed_salary >= 0),
  pay_period pay_period not null default 'monthly'
);

-- ===== helpers (security definer) usados por RLS en TODAS las tablas =====
create or replace function public.is_member(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from memberships m where m.business_id = bid and m.user_id = auth.uid() and m.active)
$$;
create or replace function public.my_role(bid uuid) returns member_role
language sql stable security definer set search_path = public as $$
  select m.role from memberships m where m.business_id = bid and m.user_id = auth.uid() and m.active limit 1
$$;
create or replace function public.my_member_id(bid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select m.id from memberships m where m.business_id = bid and m.user_id = auth.uid() and m.active limit 1
$$;
create or replace function public.has_role(bid uuid, variadic roles member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role(bid) = any(roles), false)
$$;

create table working_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  member_id uuid not null references memberships(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index on working_hours(member_id, weekday);

create table time_off (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  member_id uuid not null references memberships(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (ends_at > starts_at)
);
create index on time_off(member_id, starts_at);

create table services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  duration_min integer not null check (duration_min > 0),
  price bigint not null check (price >= 0),
  active boolean not null default true,
  color text
);
create table member_services (
  member_id uuid not null references memberships(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  price_override bigint check (price_override >= 0),
  duration_override integer check (duration_override > 0),
  primary key (member_id, service_id)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  sku text,
  price bigint not null check (price >= 0),
  cost bigint not null default 0 check (cost >= 0),
  active boolean not null default true
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  birthday date,
  notes text,
  tags text[] not null default '{}',
  custom jsonb not null default '{}',
  whatsapp_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index clients_phone_uniq on clients(business_id, phone) where phone is not null;

create table appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  member_id uuid not null references memberships(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status appointment_status not null default 'reserved',
  source appointment_source not null default 'admin',
  notes text,
  cancel_reason text,
  cancelled_by uuid,
  manage_token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_by uuid,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  constraint appointments_no_overlap exclude using gist (
    member_id with =, tstzrange(starts_at, ends_at) with &&
  ) where (status not in ('cancelled','no_show'))
);
create index on appointments(business_id, starts_at);
create unique index appointments_token_uniq on appointments(manage_token);

create table appointment_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  name text not null,
  price bigint not null,
  duration_min integer not null
);
create index on appointment_items(appointment_id);

-- ===== triggers de membresía: slug, compensación, horario y servicios por defecto =====
create or replace function public.memberships_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text; cand text; n int := 1;
begin
  if new.booking_slug is null and new.is_bookable then
    base := coalesce(nullif(slugify(new.display_name), ''), 'barbero');
    cand := base;
    while exists(select 1 from memberships where business_id = new.business_id and booking_slug = cand) loop
      n := n + 1; cand := base || '-' || n;
    end loop;
    new.booking_slug := cand;
  end if;
  return new;
end $$;
create trigger memberships_defaults_bi before insert on memberships
  for each row execute function memberships_defaults();

create or replace function public.memberships_seed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into member_compensation(member_id, business_id) values (new.id, new.business_id)
    on conflict do nothing;
  if new.is_bookable then
    -- Lunes a sábado 09:00-19:00 por defecto (editable)
    insert into working_hours(business_id, member_id, weekday, start_time, end_time)
      select new.business_id, new.id, d, '09:00', '19:00' from generate_series(1, 6) d;
    insert into member_services(member_id, service_id, business_id)
      select new.id, s.id, new.business_id from services s where s.business_id = new.business_id and s.active;
  end if;
  return new;
end $$;
create trigger memberships_seed_ai after insert on memberships
  for each row execute function memberships_seed();

create or replace function public.services_seed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into member_services(member_id, service_id, business_id)
    select m.id, new.id, new.business_id from memberships m
    where m.business_id = new.business_id and m.is_bookable and m.active
    on conflict do nothing;
  return new;
end $$;
create trigger services_seed_ai after insert on services
  for each row execute function services_seed();
