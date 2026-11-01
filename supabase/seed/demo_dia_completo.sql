-- DEMO: un día completo en una barbería (no es una migración: se corre a mano en el SQL editor).
-- Carga, para el negocio de v_slug: el catálogo de servicios de la peluquería original (House Davidson),
-- un equipo inventado, clientes inventados, las citas de HOY (atendidas, no show, cancelada y pendientes),
-- una venta de productos, gastos y un adelanto. Todo pasa por las mismas funciones que usa la app
-- (attend_appointment, pay_sale, record_expense...), así que la caja, las comisiones y el libro salen reales.
-- No cierra el día: la caja de hoy queda abierta para que la cierres tú. Se puede correr una sola vez.
-- Los clientes demo llevan la etiqueta 'demo' y sin WhatsApp activado: no se envía ningún mensaje.
do $$
declare
  v_slug constant text := 'lumos-studio';
  bid uuid; uid uuid; tz text; hoy date;
  r record; it record; i int;
  cid uuid; aid uuid; mid uuid; pid uuid; cat_ins uuid; cat_otros uuid; cat_serv uuid;
  cl uuid[] := '{}'; members jsonb := '{}'::jsonb;
  t_start timestamptz; t_end timestamptz; dur int;
  names text[] := array['Carlos Mendoza','Luis Alvarado','Jorge Palma','Andrés Cedeño','Fernando Zambrano','Marco Intriago','Pablo Loor','David Macías','Kevin Delgado','Santiago Briones',
                        'Esteban Vera','Javier Cobeña','Mateo Solórzano','Bryan Zamora','Cristian Párraga','Wilson Mero','Anthony Chávez','Daniela Pincay','Gabriela Moreira','Lucía Menéndez'];
  k int := 0; sales_n int; sale_price bigint;
begin
  select id, timezone into bid, tz from businesses where slug = v_slug;
  if bid is null then raise exception 'No existe el negocio %', v_slug; end if;
  if exists (select 1 from clients where business_id = bid and 'demo' = any(tags)) then
    raise notice 'La demo ya estaba cargada en %. No se hizo nada.', v_slug; return;
  end if;
  select user_id into uid from memberships where business_id = bid and role = 'owner' and user_id is not null limit 1;
  if uid is null then raise exception 'El negocio % no tiene dueño con cuenta', v_slug; end if;
  -- Las funciones de la app leen auth.uid(): se actúa como el dueño durante esta transacción.
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  hoy := (now() at time zone tz)::date;
  if exists (select 1 from cash_days where business_id = bid and day = hoy) then raise exception 'El día de hoy ya está cerrado'; end if;

  -- 1) Servicios: los mismos de la peluquería original (House Davidson), sin repetir los que ya existan.
  for r in
    select regexp_replace(btrim(s.name), '\s+', ' ', 'g') as n, s.description, s.duration_min, s.price, s.sort_order
    from services s join businesses h on h.id = s.business_id and h.slug = 'house-davidson' where s.active order by s.sort_order
  loop
    if not exists (select 1 from services where business_id = bid and lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) = lower(r.n)) then
      insert into services(business_id, name, description, duration_min, price, sort_order)
      values (bid, upper(left(r.n, 1)) || substr(r.n, 2), r.description, r.duration_min, r.price, 100 + r.sort_order);
    end if;
  end loop;

  -- 2) Equipo inventado (sin cuenta de usuario). El trigger les da horario lun-sáb 09:00-19:00 y todos los servicios.
  for r in select * from (values ('Mateo Rivas', 'barber', true), ('Sebastián Mora', 'barber', true), ('Diego Cedeño', 'barber', true),
                                 ('Camila Vera', 'barber', true), ('Rosa Intriago', 'receptionist', false)) v(n, role, bookable) loop
    select id into mid from memberships where business_id = bid and display_name = r.n;
    if mid is null then
      insert into memberships(business_id, display_name, role, is_bookable) values (bid, r.n, r.role::member_role, r.bookable) returning id into mid;
    end if;
    members := members || jsonb_build_object(r.n, mid);
  end loop;
  -- Camila: estética (facial, uñas, cejas, trenzas). El resto: cabello y barba.
  delete from member_services ms using services s
    where ms.service_id = s.id and ms.member_id = (members->>'Camila Vera')::uuid
      and lower(regexp_replace(btrim(s.name), '\s+', ' ', 'g')) not in ('servicio facial vip', 'servicio de cejas', 'depilación nasal', 'servicio de uñas vip',
                                                                      'servicio uñas premium', 'servicio de pedicura premium', 'servicios de trenzas');
  delete from member_services ms using services s
    where ms.service_id = s.id and ms.member_id in ((members->>'Mateo Rivas')::uuid, (members->>'Sebastián Mora')::uuid, (members->>'Diego Cedeño')::uuid)
      and lower(regexp_replace(btrim(s.name), '\s+', ' ', 'g')) in ('servicio de uñas vip', 'servicio uñas premium', 'servicio de pedicura premium', 'servicios de trenzas');

  -- 3) Clientes inventados. Sin WhatsApp activado a propósito.
  for i in 1..array_length(names, 1) loop
    insert into clients(business_id, full_name, phone, tags, whatsapp_opt_in)
    values (bid, names[i], '+59399' || lpad((1000000 + i * 7919)::text, 7, '0'), '{demo}', false) returning id into cid;
    cl := cl || cid;
  end loop;

  -- 4) Las citas de hoy. plan: cash/transfer = atendida y cobrada, noshow, cancelled, pending = por venir.
  for r in select * from (values
    ('Mateo Rivas',    '09:00', array['servicio vip'],                                        'cash',     300),
    ('Mateo Rivas',    '10:15', array['servicio premium'],                                    'transfer', 0),
    ('Mateo Rivas',    '11:30', array['servicio oro'],                                        'cash',     200),
    ('Mateo Rivas',    '14:00', array['servicio oro', 'servicio de cejas'],                   'cash',     0),
    ('Mateo Rivas',    '15:00', array['servicio platinium', 'depilación nasal'],              'transfer', 0),
    ('Mateo Rivas',    '16:00', array['servicio premium'],                                    'cash',     500),
    ('Mateo Rivas',    '17:15', array['servicio vip'],                                        'pending',  0),
    ('Sebastián Mora', '09:30', array['servicio plata'],                                      'cash',     0),
    ('Sebastián Mora', '10:30', array['servicio básico', 'servicio de cejas'],                'transfer', 100),
    ('Sebastián Mora', '11:15', array['servicio juvenil'],                                    'cash',     0),
    ('Sebastián Mora', '12:00', array['servicio platinium'],                                  'cash',     0),
    ('Sebastián Mora', '14:30', array['servicio barba platinium', 'servicio básico'],         'transfer', 200),
    ('Sebastián Mora', '15:45', array['servicio kids'],                                       'cancelled', 0),
    ('Sebastián Mora', '16:30', array['servicio oro'],                                        'cash',     0),
    ('Sebastián Mora', '17:30', array['servicio plata'],                                      'pending',  0),
    ('Diego Cedeño',   '09:00', array['servicios tinturados rayitos'],                        'transfer', 500),
    ('Diego Cedeño',   '12:30', array['cubrimiento de canas', 'servicio básico'],             'cash',     0),
    ('Diego Cedeño',   '14:00', array['servicio de ondulaciones permanente'],                 'transfer', 0),
    ('Diego Cedeño',   '17:30', array['servicio básico'],                                     'noshow',   0),
    ('Camila Vera',    '09:30', array['servicio facial vip'],                                 'cash',     0),
    ('Camila Vera',    '10:15', array['servicio de uñas vip'],                                'transfer', 200),
    ('Camila Vera',    '11:30', array['servicio de pedicura premium'],                        'cash',     0),
    ('Camila Vera',    '12:15', array['servicio uñas premium'],                               'cash',     0),
    ('Camila Vera',    '14:30', array['servicios de trenzas'],                                'cash',     300),
    ('Camila Vera',    '15:30', array['servicio facial vip', 'servicio de cejas'],            'transfer', 0),
    ('Camila Vera',    '16:30', array['servicio de uñas vip'],                                'pending',  0)
  ) v(member, at, svcs, plan, tip) loop
    k := k + 1;
    mid := (members->>r.member)::uuid;
    dur := 0;
    t_start := (hoy + r.at::time)::timestamp at time zone tz;
    select coalesce(sum(s.duration_min), 0) into dur from unnest(r.svcs) u(nm)
      join services s on s.business_id = bid and lower(regexp_replace(btrim(s.name), '\s+', ' ', 'g')) = u.nm;
    if dur = 0 then raise exception 'No encontré los servicios % en el catálogo', r.svcs; end if;
    t_end := t_start + make_interval(mins => dur);
    insert into appointments(business_id, client_id, member_id, starts_at, ends_at, status, source, created_by, cancel_reason)
    values (bid, cl[1 + (k * 7) % array_length(cl, 1)], mid, t_start, t_end,
            case r.plan when 'cancelled' then 'cancelled'::appointment_status when 'noshow' then 'reserved' else 'confirmed' end,
            (array['booking_link', 'admin', 'whatsapp'])[1 + k % 3]::appointment_source, uid,
            case when r.plan = 'cancelled' then 'El cliente avisó que no puede venir' end)
    returning id into aid;
    insert into appointment_items(business_id, appointment_id, service_id, name, price, duration_min)
      select bid, aid, s.id, s.name, s.price, s.duration_min from unnest(r.svcs) with ordinality u(nm, ord)
        join services s on s.business_id = bid and lower(regexp_replace(btrim(s.name), '\s+', ' ', 'g')) = u.nm order by u.ord;
    if r.plan in ('cash', 'transfer') then
      perform attend_appointment(aid, r.plan::pay_method, 0, r.tip);
    elsif r.plan = 'noshow' then
      perform mark_no_show(aid);
    end if;
  end loop;

  -- 5) Venta de mostrador: productos.
  insert into products(business_id, name, sku, price, cost, stock, min_stock, category)
  select bid, p.n, p.sku, p.price, p.cost, p.stock, 3, 'Productos' from (values
    ('Cera para peinar', 'CER-01', 1200, 600, 18), ('Aceite para barba', 'ACE-01', 1500, 700, 12), ('Shampoo premium', 'SHA-01', 1000, 450, 2)
  ) p(n, sku, price, cost, stock) where not exists (select 1 from products where business_id = bid and name = p.n);
  select id, price into pid, sale_price from products where business_id = bid and name = 'Cera para peinar';
  perform pay_sale(bid, null, cl[3], (members->>'Mateo Rivas')::uuid,
    jsonb_build_array(jsonb_build_object('item_type', 'product', 'item_id', pid, 'qty', 1)), 0, 0,
    jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', sale_price)));
  select id, price into pid, sale_price from products where business_id = bid and name = 'Aceite para barba';
  perform pay_sale(bid, null, cl[8], (members->>'Sebastián Mora')::uuid,
    jsonb_build_array(jsonb_build_object('item_type', 'product', 'item_id', pid, 'qty', 2)), 0, 0,
    jsonb_build_array(jsonb_build_object('method', 'transfer', 'amount', sale_price * 2)));

  -- 6) Gastos del día y un adelanto de sueldo.
  select id into cat_ins from expense_categories where business_id = bid and name = 'Insumos';
  select id into cat_serv from expense_categories where business_id = bid and name = 'Servicios públicos';
  select id into cat_otros from expense_categories where business_id = bid and name = 'Otros';
  perform record_expense(bid, cat_ins, 4500, 'cash', 'Navajas y cuchillas de repuesto');
  perform record_expense(bid, cat_ins, 2500, 'cash', 'Toallas y capas desechables');
  perform record_expense(bid, cat_serv, 3000, 'transfer', 'Internet del local');
  perform record_expense(bid, cat_otros, 1200, 'cash', 'Almuerzo del equipo');
  perform register_advance(bid, (members->>'Diego Cedeño')::uuid, 2000, 'cash', 'Adelanto de sueldo');

  -- 7) Nada de mensajes a números inventados.
  delete from scheduled_messages where business_id = bid and client_id = any(cl);

  select count(*) into sales_n from sales where business_id = bid and status = 'paid' and (created_at at time zone tz)::date = hoy;
  raise notice 'Demo cargada en %: % ventas cobradas hoy, % clientes, 5 personas en el equipo. Abre Caja para ver el reporte del día.', v_slug, sales_n, array_length(cl, 1);
end $$;
