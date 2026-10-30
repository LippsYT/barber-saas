-- 0013: corrige normalize_phone (11+ dígitos = ya trae código de país).
create or replace function public.normalize_phone(p text, cc text default '593')
returns text language plpgsql immutable set search_path = public as $$
declare s text := btrim(coalesce(p, '')); d text; c text := coalesce(nullif(cc, ''), '593');
begin
  d := regexp_replace(s, '[^0-9]', '', 'g');
  if d = '' then return null; end if;
  if left(s, 1) = '+' then return '+' || d; end if;
  if left(d, 2) = '00' then return '+' || substr(d, 3); end if;
  if left(d, 1) = '0' then return '+' || c || ltrim(d, '0'); end if;
  -- 11+ dígitos sin + ni 0: ya trae código de país (ej. 593991234567, 5491157604074).
  if length(d) >= 11 then return '+' || d; end if;
  return '+' || c || d;
end $$;

-- 0012 anteponía +593 a números internacionales escritos sin "+" (ej. 5491157604074 -> +5935491157604074).
-- Revierte esos casos: +593 seguido de 11+ dígitos que no empiezan con 0 no es un número ecuatoriano válido.
update clients c set phone = '+' || substr(c.phone, 5)
where c.phone ~ '^\+593[1-9][0-9]{10,}$'
  and not exists (select 1 from clients o where o.business_id = c.business_id and o.id <> c.id and o.phone = '+' || substr(c.phone, 5));
