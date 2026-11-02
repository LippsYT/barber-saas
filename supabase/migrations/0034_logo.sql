-- Logotipo del negocio. Se sube a Storage (bucket público covers) y aquí se guarda solo la URL pública.
alter table businesses add column if not exists logo_url text;

-- El catálogo público devuelve también el logo. Se envuelve la función actual en vez de copiarla:
-- la original pasa a _public_get_catalog_base y la pública le añade business.logo_url.
-- Si más adelante se redefine public_get_catalog, hay que volver a incluir logo_url.
do $$
begin
  if to_regprocedure('public._public_get_catalog_base(text)') is null then
    alter function public.public_get_catalog(text) rename to _public_get_catalog_base;
  end if;
end $$;
revoke all on function public._public_get_catalog_base(text) from public, anon, authenticated;

create or replace function public.public_get_catalog(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when x.c is null then null
              else jsonb_set(x.c, '{business,logo_url}', coalesce(to_jsonb((select b.logo_url from businesses b where b.slug = p_slug)), 'null'::jsonb)) end
  from (select public._public_get_catalog_base(p_slug) as c) x
$$;
revoke all on function public.public_get_catalog(text) from public;
grant execute on function public.public_get_catalog(text) to anon, authenticated;
