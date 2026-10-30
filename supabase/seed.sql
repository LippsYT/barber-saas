-- Seed demo: dueño + 2 barberos (con login) + servicios.
-- Reemplazar __DEMO_PASSWORD__ antes de ejecutar (no se versiona ninguna contraseña real).
create extension if not exists pgcrypto;
do $$
declare
  pw text := '__DEMO_PASSWORD__';
  u record; bid uuid;
begin
  for u in select * from (values
      ('11111111-1111-4111-8111-111111111111'::uuid, 'dueno@demo-barberia.test'),
      ('22222222-2222-4222-8222-222222222222'::uuid, 'carlos@demo-barberia.test'),
      ('33333333-3333-4333-8333-333333333333'::uuid, 'andres@demo-barberia.test')) v(id, email)
  loop
    if not exists (select 1 from auth.users where id = u.id) then
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
      values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
        extensions.crypt(pw, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
      values (gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now());
    end if;
  end loop;

  if exists (select 1 from businesses where slug = 'demo') then return; end if;
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  bid := public.create_business('Barbería Demo', 'demo', 'Felipe (dueño)', 'America/Bogota', 'COP', true);

  insert into services (business_id, name, duration_min, price) values
    (bid, 'Corte clásico', 30, 25000), (bid, 'Barba', 20, 15000), (bid, 'Corte + barba', 50, 35000);
  insert into memberships (business_id, user_id, display_name, role, booking_slug, is_bookable) values
    (bid, '22222222-2222-4222-8222-222222222222', 'Carlos', 'barber', 'carlos', true),
    (bid, '33333333-3333-4333-8333-333333333333', 'Andrés', 'barber', 'andres', true);
end $$;
