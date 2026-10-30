-- 0011: los precios del negocio demo venían del seed en pesos (25000 = "US$ 250.00").
-- Los montos se guardan en centavos de US$. Se dividen entre 10 (US$ 25 / 15 / 35),
-- solo en el negocio 'demo', solo para los 3 servicios del seed y solo si aún tienen el valor viejo.
update services s set price = s.price / 10
from businesses b
where b.id = s.business_id and b.slug = 'demo'
  and (s.name, s.price) in (('Corte clásico', 25000), ('Barba', 15000), ('Corte + barba', 35000));

update member_services ms set price_override = ms.price_override / 10
from services s join businesses b on b.id = s.business_id
where ms.service_id = s.id and b.slug = 'demo'
  and ms.price_override in (25000, 15000, 35000);
