-- 0021: la caja del día sale sola de las citas atendidas.
-- El libro (ledger_entries) sigue siendo append-only. No se reescriben asientos viejos:
-- el cierre del día los lee por fecha. Los adelantos que superan lo ganado quedan en
-- payouts.carry_forward y entran en la liquidación siguiente.

alter table expenses add column occurred_on date;
update expenses e
  set occurred_on = (e.created_at at time zone b.timezone)::date
  from businesses b
  where b.id = e.business_id and e.occurred_on is null;
alter table expenses alter column occurred_on set not null;
create index expenses_business_day on expenses(business_id, occurred_on);

alter table payouts add column carry_forward bigint not null default 0 check (carry_forward >= 0);
alter table payouts add column carry_absorbed_by uuid references payouts(id) on delete set null;

-- Un día cerrado es una fila. No hay "abrir caja".
create table cash_days (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  day date not null,
  expected_cash bigint not null,
  counted_cash bigint not null check (counted_cash >= 0),
  difference bigint not null,
  notes text,
  closed_by uuid,
  closed_at timestamptz not null default now(),
  unique (business_id, day)
);
create index cash_days_business on cash_days(business_id, day desc);

alter table cash_days enable row level security;
create policy cash_days_sel on cash_days for select to authenticated
  using (has_role(business_id, 'owner', 'admin', 'receptionist'));
revoke all on cash_days from anon, authenticated;
grant select on cash_days to authenticated;
grant all on cash_days to service_role;
create trigger audit_cash_days after insert on cash_days
  for each row execute function audit_trigger();

create or replace function public._business_today(p_business uuid) returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone timezone)::date from businesses where id = p_business
$$;

create or replace function public._assert_day_open(p_business uuid, p_day date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_day is not null and exists (select 1 from cash_days where business_id = p_business and day = p_day) then
    raise exception 'day_locked';
  end if;
end $$;

-- p_at permite fechar un gasto en el día que eligió la persona. El resto sigue en "ahora".
drop function public._ledger(uuid, ledger_type, int, bigint, pay_method, ledger_account, uuid, text, uuid, text, uuid, uuid);
create function public._ledger(bid uuid, p_type ledger_type, p_dir int, p_amount bigint, p_method pay_method,
  p_account ledger_account, p_member uuid, p_src text, p_src_id uuid, p_desc text, p_session uuid,
  p_reversal_of uuid default null, p_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare id uuid;
begin
  insert into ledger_entries(business_id, occurred_at, type, direction, amount, method, account, member_id, source_table, source_id,
                             description, cash_session_id, created_by, reversal_of)
  values (bid, coalesce(p_at, clock_timestamp()), p_type, p_dir, p_amount, p_method, p_account, p_member, p_src, p_src_id,
          p_desc, p_session, auth.uid(), p_reversal_of)
  returning ledger_entries.id into id;
  return id;
end $$;

-- Venta ya con precios resueltos (catálogo o precio reservado en la cita).
create or replace function public._commit_sale(p_business uuid, p_appointment uuid, p_client uuid, p_member uuid,
  p_types rule_item_type[], p_ids uuid[], p_names text[], p_mems uuid[], p_qtys int[], p_prices bigint[],
  p_discount bigint, p_tip bigint, p_payments jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  b businesses; sale sales; sess uuid; num int; n int; i int;
  allocs bigint[] := '{}'; gross_total bigint := 0; d bigint; rest bigint; add bigint;
  income bigint; tip bigint; paid bigint := 0; income_left bigint; pay jsonb; amt bigint; to_inc bigint; meth pay_method;
  today date; sale_item_ids uuid[] := '{}'; sii uuid; si sale_items; desc_items text;
begin
  select * into b from businesses where id = p_business;
  if not found then raise exception 'forbidden'; end if;
  today := (now() at time zone b.timezone)::date;
  perform _assert_day_open(p_business, today);
  n := coalesce(array_length(p_types, 1), 0);
  if n = 0 then raise exception 'empty_sale'; end if;
  for i in 1..n loop
    if p_qtys[i] < 1 or p_prices[i] < 0 then raise exception 'invalid_price'; end if;
    gross_total := gross_total + p_qtys[i] * p_prices[i];
  end loop;
  d := least(greatest(coalesce(p_discount, 0), 0), gross_total);
  tip := greatest(coalesce(p_tip, 0), 0);
  rest := d;
  for i in 1..n loop
    allocs := allocs || (case when gross_total = 0 then 0 else (p_qtys[i] * p_prices[i] * d) / gross_total end)::bigint;
    rest := rest - allocs[i];
  end loop;
  for i in reverse n..1 loop
    exit when rest <= 0;
    add := least(p_qtys[i] * p_prices[i] - allocs[i], rest);
    allocs[i] := allocs[i] + add;
    rest := rest - add;
  end loop;
  income := gross_total - d;
  for pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    if (pay->>'amount')::bigint <= 0 then raise exception 'invalid_payment'; end if;
    paid := paid + (pay->>'amount')::bigint;
  end loop;
  if income + tip <= 0 then raise exception 'empty_sale'; end if;
  if paid <> income + tip then raise exception 'payments_mismatch: pagos % vs total %', paid, income + tip; end if;

  update businesses set sale_seq = sale_seq + 1 where id = p_business returning sale_seq into num;
  sess := _ensure_session(p_business);
  insert into sales(business_id, number, appointment_id, client_id, member_id, status, subtotal, discount, tip, total, cash_session_id, created_by)
    values (p_business, num, p_appointment, p_client, p_member, 'paid', gross_total, d, tip, income + tip, sess, auth.uid())
    returning * into sale;
  for i in 1..n loop
    insert into sale_items(business_id, sale_id, item_type, item_id, name, member_id, qty, unit_price, discount, line_total)
      values (p_business, sale.id, p_types[i], p_ids[i], p_names[i], p_mems[i], p_qtys[i], p_prices[i], allocs[i], p_qtys[i] * p_prices[i] - allocs[i])
      returning id into sii;
    sale_item_ids := sale_item_ids || sii;
  end loop;
  for pay in select * from jsonb_array_elements(p_payments) loop
    insert into payments(business_id, sale_id, method, amount, reference)
      values (p_business, sale.id, (pay->>'method')::pay_method, (pay->>'amount')::bigint, pay->>'reference');
  end loop;

  select string_agg(distinct x, ', ') into desc_items from unnest(p_names) x;
  income_left := income;
  for pay in select * from jsonb_array_elements(p_payments) loop
    amt := (pay->>'amount')::bigint; meth := (pay->>'method')::pay_method;
    to_inc := least(amt, income_left); income_left := income_left - to_inc;
    if to_inc > 0 then
      perform _ledger(p_business, 'sale_income', 1, to_inc, meth, _account_of(meth), p_member, 'sales', sale.id,
        format('Venta #%s · %s (%s)', num, desc_items, _method_es(meth)), sess);
    end if;
    if amt - to_inc > 0 then
      perform _ledger(p_business, 'tip_income', 1, amt - to_inc, meth, _account_of(meth), p_member, 'sales', sale.id,
        format('Propina venta #%s (%s)', num, _method_es(meth)), sess);
    end if;
  end loop;

  for i in 1..n loop
    select * into si from sale_items where id = sale_item_ids[i];
    perform _add_commission(p_business, sale, si, p_types[i], p_mems[i], p_names[i], p_qtys[i], p_prices[i], allocs[i], p_ids[i], today, sess);
  end loop;
  if tip > 0 then
    perform _add_commission(p_business, sale, null, 'tip', p_member, 'Propina', 1, tip, 0, null, today, sess);
  end if;
  if p_appointment is not null then
    update appointments set status = 'completed' where id = p_appointment and status not in ('cancelled');
  end if;
  return sale.id;
end $$;

create or replace function public.pay_sale(p_business uuid, p_appointment uuid, p_client uuid, p_member uuid,
  p_items jsonb, p_discount bigint, p_tip bigint, p_payments jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r member_role := _need_role(p_business, 'owner','admin','receptionist','barber');
  mine uuid := my_member_id(p_business);
  appt appointments; it jsonb;
  types rule_item_type[] := '{}'; ids uuid[] := '{}'; names text[] := '{}'; mems uuid[] := '{}';
  qtys int[] := '{}'; prices bigint[] := '{}'; used uuid[] := '{}';
  v_item uuid; v_mem uuid; v_qty int; v_price bigint; v_name text; v_type rule_item_type;
  snap_id uuid; snap_name text; snap_price bigint;
begin
  if not exists (select 1 from memberships where id = p_member and business_id = p_business) then raise exception 'invalid_member'; end if;
  if r = 'barber' and p_member <> mine then raise exception 'forbidden'; end if;
  if p_appointment is not null then
    select * into appt from appointments where id = p_appointment and business_id = p_business;
    if not found then raise exception 'appointment_not_found'; end if;
    if r = 'barber' and appt.member_id <> mine then raise exception 'forbidden'; end if;
  end if;
  if p_client is not null and not exists (select 1 from clients where id = p_client and business_id = p_business) then raise exception 'invalid_client'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty_sale'; end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_type := (it->>'item_type')::rule_item_type;
    v_item := (it->>'item_id')::uuid;
    v_qty := coalesce((it->>'qty')::int, 1);
    v_mem := coalesce((it->>'member_id')::uuid, p_member);
    v_name := null; v_price := null; snap_id := null;
    if r = 'barber' then v_mem := mine; end if;
    if v_qty < 1 or v_qty > 100 then raise exception 'invalid_qty'; end if;
    if not exists (select 1 from memberships where id = v_mem and business_id = p_business) then raise exception 'invalid_member'; end if;
    if p_appointment is not null and v_type = 'service' then
      select ai.id, ai.name, ai.price into snap_id, snap_name, snap_price
        from appointment_items ai
        where ai.appointment_id = p_appointment and ai.business_id = p_business
          and ai.service_id is not distinct from v_item
          and not (ai.id = any(used))
        order by ai.id limit 1;
      if snap_id is not null then
        v_name := snap_name; v_price := snap_price; used := used || snap_id;
      end if;
    end if;
    if v_name is null then
      if v_type = 'service' then
        select s.name, coalesce(ms.price_override, s.price) into v_name, v_price from services s
          left join member_services ms on ms.service_id = s.id and ms.member_id = v_mem
          where s.id = v_item and s.business_id = p_business and s.active;
      elsif v_type = 'product' then
        select name, price into v_name, v_price from products where id = v_item and business_id = p_business and active;
      else raise exception 'invalid_item_type'; end if;
    end if;
    if v_name is null then raise exception 'item_not_found'; end if;
    if r <> 'barber' and it ? 'unit_price' then v_price := (it->>'unit_price')::bigint; end if;
    if v_price < 0 then raise exception 'invalid_price'; end if;
    types := types || v_type; ids := ids || v_item; names := names || v_name; mems := mems || v_mem;
    qtys := qtys || v_qty; prices := prices || v_price;
  end loop;
  return _commit_sale(p_business, p_appointment, coalesce(p_client, appt.client_id), p_member,
    types, ids, names, mems, qtys, prices, coalesce(p_discount, 0), coalesce(p_tip, 0), coalesce(p_payments, '[]'::jsonb));
end $$;

-- Marcar atendida: cobra el precio que quedó guardado al reservar, con ajuste y propina opcionales.
create or replace function public.attend_appointment(p_appointment uuid, p_method pay_method, p_adjustment bigint default 0, p_tip bigint default 0)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  a appointments; b businesses; r member_role; mine uuid; it appointment_items;
  names text[] := '{}'; ids uuid[] := '{}'; types rule_item_type[] := '{}'; mems uuid[] := '{}';
  qtys int[] := '{}'; prices bigint[] := '{}';
  n int; sub bigint := 0; adj bigint; tip bigint; charged bigint; disc bigint;
begin
  select * into a from appointments where id = p_appointment;
  if not found then raise exception 'appointment_not_found'; end if;
  r := _need_role(a.business_id, 'owner', 'admin', 'receptionist', 'barber');
  mine := my_member_id(a.business_id);
  if r = 'barber' and a.member_id <> mine then raise exception 'forbidden'; end if;
  if a.status in ('cancelled', 'no_show') then raise exception 'appointment_closed'; end if;
  if exists (select 1 from sales where appointment_id = a.id and status = 'paid') then raise exception 'already_attended'; end if;
  select * into b from businesses where id = a.business_id;
  perform _assert_day_open(a.business_id, (now() at time zone b.timezone)::date);
  if p_method not in ('cash', 'transfer') then raise exception 'invalid_method'; end if;
  for it in select * from appointment_items where appointment_id = a.id order by id loop
    names := array_append(names, it.name);
    ids := array_append(ids, it.service_id);
    types := array_append(types, 'service'::rule_item_type);
    mems := array_append(mems, a.member_id);
    qtys := array_append(qtys, 1);
    prices := array_append(prices, it.price);
    sub := sub + it.price;
  end loop;
  n := coalesce(array_length(names, 1), 0);
  if n = 0 then raise exception 'empty_sale'; end if;
  adj := coalesce(p_adjustment, 0);
  tip := greatest(coalesce(p_tip, 0), 0);
  if sub + adj < 0 then raise exception 'invalid_adjustment'; end if;
  if adj > 0 then
    prices[n] := prices[n] + adj;
    sub := sub + adj;
  end if;
  disc := greatest(-adj, 0);
  charged := sub - disc;
  if charged + tip <= 0 then
    update appointments set status = 'completed' where id = a.id;
    return null;
  end if;
  return _commit_sale(a.business_id, a.id, a.client_id, a.member_id, types, ids, names, mems, qtys, prices, disc, tip,
    jsonb_build_array(jsonb_build_object('method', p_method, 'amount', charged + tip)));
end $$;

create or replace function public.mark_no_show(p_appointment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a appointments; r member_role; mine uuid;
begin
  select * into a from appointments where id = p_appointment;
  if not found then raise exception 'appointment_not_found'; end if;
  r := _need_role(a.business_id, 'owner', 'admin', 'receptionist', 'barber');
  mine := my_member_id(a.business_id);
  if r = 'barber' and a.member_id <> mine then raise exception 'forbidden'; end if;
  if exists (select 1 from sales where appointment_id = a.id and status = 'paid') then raise exception 'already_attended'; end if;
  if a.status in ('cancelled', 'completed', 'no_show') then raise exception 'appointment_closed'; end if;
  update appointments set status = 'no_show' where id = a.id;
end $$;

create or replace function public.record_expense(p_business uuid, p_category uuid, p_amount bigint, p_method pay_method,
  p_description text, p_receipt_url text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare r member_role := _need_role(p_business, 'owner', 'admin', 'receptionist'); new_id uuid; sess uuid; b businesses; lim bigint; hoy date;
begin
  select * into b from businesses where id = p_business;
  hoy := (now() at time zone b.timezone)::date;
  perform _assert_day_open(p_business, hoy);
  lim := coalesce((b.settings->>'receptionist_expense_limit')::bigint, 200000);
  if r = 'receptionist' and p_amount > lim then raise exception 'expense_over_limit'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  if length(trim(coalesce(p_description, ''))) < 2 then raise exception 'description_required'; end if;
  if p_category is not null and not exists (select 1 from expense_categories where id = p_category and business_id = p_business) then raise exception 'invalid_category'; end if;
  sess := _ensure_session(p_business);
  insert into expenses(business_id, category_id, amount, method, description, receipt_url, cash_session_id, created_by, occurred_on)
    values (p_business, p_category, p_amount, p_method, trim(p_description), p_receipt_url, sess, auth.uid(), hoy) returning expenses.id into new_id;
  perform _ledger(p_business, 'expense', -1, p_amount, p_method, _account_of(p_method), null, 'expenses', new_id,
    format('Gasto: %s (%s)', trim(p_description), _method_es(p_method)), sess);
  return new_id;
end $$;

create or replace function public.record_expense_on(p_business uuid, p_amount bigint, p_method pay_method, p_description text, p_on date)
returns uuid language plpgsql security definer set search_path = public as $$
declare r member_role := _need_role(p_business, 'owner', 'admin', 'receptionist'); new_id uuid; sess uuid; b businesses; lim bigint; v_at timestamptz;
begin
  select * into b from businesses where id = p_business;
  if p_on is null or p_on > (now() at time zone b.timezone)::date then raise exception 'invalid_day'; end if;
  perform _assert_day_open(p_business, p_on);
  lim := coalesce((b.settings->>'receptionist_expense_limit')::bigint, 200000);
  if r = 'receptionist' and p_amount > lim then raise exception 'expense_over_limit'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  if length(trim(coalesce(p_description, ''))) < 2 then raise exception 'description_required'; end if;
  if p_method not in ('cash', 'transfer', 'card', 'other') then raise exception 'invalid_method'; end if;
  sess := _ensure_session(p_business);
  v_at := (p_on + time '12:00') at time zone b.timezone;
  insert into expenses(business_id, amount, method, description, cash_session_id, created_by, occurred_on)
    values (p_business, p_amount, p_method, trim(p_description), sess, auth.uid(), p_on) returning expenses.id into new_id;
  perform _ledger(p_business, 'expense', -1, p_amount, p_method, _account_of(p_method), null, 'expenses', new_id,
    format('Gasto: %s (%s)', trim(p_description), _method_es(p_method)), sess, null, v_at);
  return new_id;
end $$;

create or replace function public._do_void_sale(p_sale uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare s sales; sess uuid; e ledger_entries; c commission_entries; tz text; sale_day date;
begin
  select * into s from sales where id = p_sale for update;
  if not found then raise exception 'sale_not_found'; end if;
  if s.status <> 'paid' then raise exception 'sale_not_paid'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required'; end if;
  select timezone into tz from businesses where id = s.business_id;
  sale_day := (s.created_at at time zone tz)::date;
  perform _assert_day_open(s.business_id, _business_today(s.business_id));
  perform _assert_day_open(s.business_id, sale_day);
  sess := _ensure_session(s.business_id);
  update sales set status = 'voided', voided_by = auth.uid(), voided_at = now(), void_reason = p_reason where id = p_sale;
  for e in select * from ledger_entries where source_table = 'sales' and source_id = p_sale and reversal_of is null and type <> 'void_reversal' order by occurred_at, id loop
    perform _ledger(s.business_id, 'void_reversal', -e.direction, e.amount, e.method, e.account, e.member_id, 'sales', p_sale,
      format('Anulación venta #%s: %s (motivo: %s)', s.number, e.description, p_reason), sess, e.id);
  end loop;
  for c in select * from commission_entries where sale_id = p_sale and reversal_of is null order by created_at, id loop
    insert into commission_entries(business_id, member_id, sale_id, sale_item_id, item_type, description, rule_id, base_amount, rule_snapshot, amount, reversal_of)
      values (c.business_id, c.member_id, c.sale_id, c.sale_item_id, c.item_type, 'Anulación: ' || c.description, c.rule_id, c.base_amount, c.rule_snapshot, -c.amount, c.id);
  end loop;
  update void_requests set status = 'approved', decided_by = auth.uid(), decided_at = now() where sale_id = p_sale and status = 'pending';
end $$;

create or replace function public.void_expense(p_expense uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare x expenses; e ledger_entries; sess uuid;
begin
  select * into x from expenses where id = p_expense for update;
  if not found then raise exception 'expense_not_found'; end if;
  perform _need_role(x.business_id, 'owner', 'admin');
  if x.status <> 'active' then raise exception 'already_voided'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required'; end if;
  perform _assert_day_open(x.business_id, _business_today(x.business_id));
  perform _assert_day_open(x.business_id, x.occurred_on);
  sess := _ensure_session(x.business_id);
  update expenses set status = 'voided', void_reason = p_reason, voided_by = auth.uid() where id = p_expense;
  for e in select * from ledger_entries where source_table = 'expenses' and source_id = p_expense and reversal_of is null loop
    perform _ledger(x.business_id, 'void_reversal', -e.direction, e.amount, e.method, e.account, e.member_id, 'expenses', p_expense,
      format('Anulación gasto: %s (motivo: %s)', x.description, p_reason), sess, e.id);
  end loop;
end $$;

create or replace function public.register_advance(p_business uuid, p_member uuid, p_amount bigint, p_method pay_method, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid; sess uuid; nm text;
begin
  perform _need_role(p_business, 'owner', 'admin');
  perform _assert_day_open(p_business, _business_today(p_business));
  select display_name into nm from memberships where id = p_member and business_id = p_business;
  if nm is null then raise exception 'invalid_member'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  sess := case when p_method = 'cash' then _ensure_session(p_business) end;
  insert into staff_advances(business_id, member_id, amount, method, note, created_by)
    values (p_business, p_member, p_amount, p_method, p_note, auth.uid()) returning staff_advances.id into new_id;
  perform _ledger(p_business, 'payout', -1, p_amount, p_method, _account_of(p_method), p_member, 'staff_advances', new_id, format('Adelanto a %s (%s)', nm, _method_es(p_method)), sess);
  perform _ledger(p_business, 'payout', -1, p_amount, null, 'payable_staff', p_member, 'staff_advances', new_id, format('Adelanto a %s: descuenta lo que se le debe', nm), null);
  return new_id;
end $$;

create or replace function public.pay_payout(p_payout uuid, p_method pay_method) returns void
language plpgsql security definer set search_path = public as $$
declare p payouts; sess uuid; nm text;
begin
  select * into p from payouts where id = p_payout for update;
  if not found then raise exception 'payout_not_found'; end if;
  perform _need_role(p.business_id, 'owner', 'admin');
  perform _assert_day_open(p.business_id, _business_today(p.business_id));
  if p.status <> 'approved' then raise exception 'payout_not_approved'; end if;
  select display_name into nm from memberships where id = p.member_id;
  if p.total > 0 then
    sess := case when p_method = 'cash' then _ensure_session(p.business_id) end;
    perform _ledger(p.business_id, 'payout', -1, p.total, p_method, _account_of(p_method), p.member_id, 'payouts', p.id,
      format('Pago de liquidación a %s (%s a %s, %s)', nm, p.period_start, p.period_end, _method_es(p_method)), sess);
    perform _ledger(p.business_id, 'payout', -1, p.total, null, 'payable_staff', p.member_id, 'payouts', p.id,
      format('Liquidación pagada a %s', nm), null);
  end if;
  update payouts set status = 'paid', paid_at = now(), paid_method = p_method, paid_by = auth.uid() where id = p_payout;
end $$;

-- Si adelantos > ganado, total a pagar queda en 0 y carry_forward pasa a la próxima liquidación.
create or replace function public._recalc_payout(p_payout uuid) returns void
language plpgsql security definer set search_path = public as $$
declare net bigint;
begin
  update payouts p set
    commission_total = coalesce((select sum(amount) from payout_lines where payout_id = p.id and kind = 'commission'), 0),
    adjustments = coalesce((select sum(amount) from payout_lines where payout_id = p.id and kind = 'adjustment'), 0),
    advances = coalesce((select sum(amount) from payout_lines where payout_id = p.id and kind = 'advance'), 0)
  where p.id = p_payout;
  select commission_total + fixed_amount + adjustments - advances into net from payouts where id = p_payout;
  update payouts set
    carry_forward = greatest(-net, 0),
    total = greatest(net, 0)
  where id = p_payout;
end $$;

create or replace function public.generate_payout(p_business uuid, p_member uuid, p_start date, p_end date) returns uuid
language plpgsql security definer set search_path = public as $$
declare b businesses; comp member_compensation; pid uuid; days int; pd int; used int; fx bigint := 0; note text := 'sin sueldo fijo';
begin
  perform _need_role(p_business, 'owner', 'admin');
  select * into b from businesses where id = p_business;
  select * into comp from member_compensation where member_id = p_member and business_id = p_business;
  if not found then raise exception 'invalid_member'; end if;
  if p_end < p_start then raise exception 'invalid_period'; end if;
  if comp.pay_type <> 'commission' then
    days := p_end - p_start + 1;
    pd := case comp.pay_period when 'weekly' then 7 when 'biweekly' then 14
          else extract(day from (date_trunc('month', p_start) + interval '1 month - 1 day'))::int end;
    used := least(days, pd);
    fx := floor((2 * comp.fixed_salary * used + pd)::numeric / (2 * pd))::bigint;
    note := case when used = pd then 'período completo' else format('%s/%s días', used, pd) end;
  end if;
  insert into payouts(business_id, member_id, period_start, period_end, fixed_amount, fixed_note, created_by)
    values (p_business, p_member, p_start, p_end, fx, note, auth.uid()) returning id into pid;
  if comp.pay_type <> 'fixed' then
    insert into payout_lines(business_id, payout_id, kind, ref_id, description, amount)
      select p_business, pid, 'commission', c.id, c.description || ' (' || to_char(c.occurred_at at time zone b.timezone, 'DD/MM') || ')', c.amount
      from commission_entries c
      where c.member_id = p_member and (c.occurred_at at time zone b.timezone)::date <= p_end and c.amount <> 0
        and not exists (select 1 from payout_lines l where l.kind = 'commission' and l.ref_id = c.id)
      order by c.occurred_at, c.id;
  end if;
  insert into payout_lines(business_id, payout_id, kind, ref_id, description, amount)
    select p_business, pid, 'advance', a.id, coalesce(a.note, 'Adelanto') || ' (' || to_char(a.given_at at time zone b.timezone, 'DD/MM') || ')', a.amount
    from staff_advances a
    where a.member_id = p_member and (a.given_at at time zone b.timezone)::date <= p_end
      and not exists (select 1 from payout_lines l where l.kind = 'advance' and l.ref_id = a.id);
  insert into payout_lines(business_id, payout_id, kind, ref_id, description, amount)
    select p_business, pid, 'advance', null,
      format('Adelanto que quedó (%s a %s)', to_char(prev.period_start, 'DD/MM'), to_char(prev.period_end, 'DD/MM')),
      prev.carry_forward
    from payouts prev
    where prev.member_id = p_member and prev.business_id = p_business
      and prev.status in ('approved', 'paid') and prev.carry_forward > 0 and prev.carry_absorbed_by is null;
  update payouts prev set carry_absorbed_by = pid
    where prev.member_id = p_member and prev.business_id = p_business
      and prev.status in ('approved', 'paid') and prev.carry_forward > 0 and prev.carry_absorbed_by is null;
  perform _recalc_payout(pid);
  return pid;
exception when unique_violation then
  raise exception 'draft_already_exists';
end $$;

create or replace function public.discard_payout(p_payout uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p payouts;
begin
  select * into p from payouts where id = p_payout for update;
  perform _need_role(p.business_id, 'owner', 'admin');
  if p.status <> 'draft' then raise exception 'payout_not_draft'; end if;
  update payouts set carry_absorbed_by = null where carry_absorbed_by = p_payout;
  delete from payouts where id = p_payout;
end $$;

create or replace function public.pay_settlement(p_business uuid, p_member uuid, p_start date, p_end date, p_method pay_method)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid uuid; p payouts;
begin
  perform _need_role(p_business, 'owner');
  if p_method not in ('cash', 'transfer') then raise exception 'invalid_method'; end if;
  select id into pid from payouts where member_id = p_member and business_id = p_business and status = 'draft';
  if pid is null then
    pid := generate_payout(p_business, p_member, p_start, p_end);
  else
    if exists (select 1 from payouts where id = pid and (period_start <> p_start or period_end <> p_end)) then
      raise exception 'draft_already_exists';
    end if;
  end if;
  perform approve_payout(pid);
  perform pay_payout(pid, p_method);
  select * into p from payouts where id = pid;
  return jsonb_build_object(
    'payout_id', pid,
    'to_pay', p.total,
    'carry_forward', p.carry_forward,
    'commission_total', p.commission_total,
    'advances', p.advances,
    'fixed_amount', p.fixed_amount,
    'lines', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'description', description, 'amount', amount) order by id)
                       from payout_lines where payout_id = pid), '[]'::jsonb));
end $$;

create or replace function public.close_cash_day(p_business uuid, p_day date, p_counted bigint, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b businesses; exp bigint; diff bigint;
begin
  perform _need_role(p_business, 'owner', 'admin', 'receptionist');
  select * into b from businesses where id = p_business;
  if p_day is null or p_day > (now() at time zone b.timezone)::date then raise exception 'invalid_day'; end if;
  if exists (select 1 from cash_days where business_id = p_business and day = p_day) then raise exception 'day_locked'; end if;
  if p_counted is null or p_counted < 0 then raise exception 'invalid_amount'; end if;
  select coalesce(sum(direction * amount), 0)::bigint into exp
    from ledger_entries
    where business_id = p_business and account = 'cash' and (occurred_at at time zone b.timezone)::date = p_day;
  diff := p_counted - exp;
  if diff <> 0 and length(trim(coalesce(p_notes, ''))) < 3 then raise exception 'note_required'; end if;
  insert into cash_days(business_id, day, expected_cash, counted_cash, difference, notes, closed_by)
    values (p_business, p_day, exp, p_counted, diff, nullif(trim(coalesce(p_notes, '')), ''), auth.uid());
  return jsonb_build_object('expected', exp, 'counted', p_counted, 'difference', diff, 'locked', true);
end $$;

create or replace function public._cash_lines(p_business uuid, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = public as $$
  with tz as (select timezone from businesses where id = p_business),
  grouped as (
    select case
        when e.type = 'sale_income' then 'Servicios en efectivo'
        when e.type = 'tip_income' then 'Propinas en efectivo'
        when e.type = 'expense' then 'Gastos en efectivo'
        when e.type = 'payout' and e.description ilike 'Adelanto%' then 'Adelantos en efectivo'
        when e.type = 'payout' then 'Pagos al equipo en efectivo'
        when e.type = 'void_reversal' then 'Anulaciones en efectivo'
        when e.type = 'refund' then 'Devoluciones en efectivo'
        when e.type = 'cash_in' then 'Otros ingresos en efectivo'
        when e.type = 'cash_out' then 'Retiros de efectivo'
        when e.type = 'opening_float' then 'Fondo'
        else 'Otros movimientos en efectivo'
      end as label,
      sum(e.direction * e.amount)::bigint as amount
    from ledger_entries e, tz
    where e.business_id = p_business and e.account = 'cash'
      and (e.occurred_at at time zone tz.timezone)::date between p_from and p_to
    group by 1
  ),
  ord as (
    select * from (values
      ('Servicios en efectivo', 1), ('Propinas en efectivo', 2), ('Gastos en efectivo', 3),
      ('Adelantos en efectivo', 4), ('Pagos al equipo en efectivo', 5), ('Anulaciones en efectivo', 6),
      ('Devoluciones en efectivo', 7), ('Otros ingresos en efectivo', 8), ('Retiros de efectivo', 9),
      ('Fondo', 10), ('Otros movimientos en efectivo', 11)
    ) v(label, n)
  )
  select coalesce(jsonb_agg(jsonb_build_object('label', g.label, 'amount', g.amount) order by o.n), '[]'::jsonb)
  from grouped g join ord o on o.label = g.label
  where g.amount <> 0
$$;

create or replace function public.caja_dia(p_business uuid, p_day date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r member_role := _need_role(p_business, 'owner', 'admin', 'receptionist');
  tz text; svc bigint; tips bigint; exp bigint; expected bigint;
  cash_in bigint; cash_out bigint; tr_in bigint; tr_out bigint; card_in bigint; card_out bigint; ot_in bigint; ot_out bigint;
  services jsonb; expense_list jsonb; lines jsonb; closed cash_days;
begin
  if r is null then raise exception 'forbidden'; end if;
  select timezone into tz from businesses where id = p_business;
  select coalesce(sum(subtotal - discount), 0)::bigint, coalesce(sum(tip), 0)::bigint
    into svc, tips
    from sales
    where business_id = p_business and status = 'paid' and (created_at at time zone tz)::date = p_day;
  select coalesce(sum(amount), 0)::bigint into exp
    from expenses where business_id = p_business and status = 'active' and occurred_on = p_day;
  select coalesce(sum(direction * amount), 0)::bigint into expected
    from ledger_entries
    where business_id = p_business and account = 'cash' and (occurred_at at time zone tz)::date = p_day;

  select coalesce(sum(p.amount) filter (where p.method = 'cash'), 0)::bigint,
         coalesce(sum(p.amount) filter (where p.method = 'transfer'), 0)::bigint,
         coalesce(sum(p.amount) filter (where p.method = 'card'), 0)::bigint,
         coalesce(sum(p.amount) filter (where p.method = 'other'), 0)::bigint
    into cash_in, tr_in, card_in, ot_in
    from payments p join sales s on s.id = p.sale_id
    where s.business_id = p_business and s.status = 'paid' and (s.created_at at time zone tz)::date = p_day;
  select coalesce(sum(amount) filter (where method = 'cash'), 0)::bigint,
         coalesce(sum(amount) filter (where method = 'transfer'), 0)::bigint,
         coalesce(sum(amount) filter (where method = 'card'), 0)::bigint,
         coalesce(sum(amount) filter (where method = 'other'), 0)::bigint
    into cash_out, tr_out, card_out, ot_out
    from expenses where business_id = p_business and status = 'active' and occurred_on = p_day;

  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'unit_price', unit_price, 'qty', qty, 'total', total) order by total desc, name), '[]'::jsonb)
    into services
    from (
      select si.name, si.unit_price, sum(si.qty)::int qty, sum(si.line_total)::bigint total
      from sale_items si join sales s on s.id = si.sale_id
      where s.business_id = p_business and s.status = 'paid' and si.item_type = 'service'
        and (s.created_at at time zone tz)::date = p_day
      group by si.name, si.unit_price
    ) x;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'description', description, 'amount', amount, 'method', method, 'occurred_on', occurred_on) order by created_at), '[]'::jsonb)
    into expense_list
    from expenses where business_id = p_business and status = 'active' and occurred_on = p_day;

  lines := _cash_lines(p_business, p_day, p_day);
  select * into closed from cash_days where business_id = p_business and day = p_day;

  return jsonb_build_object(
    'day', p_day, 'locked', closed.id is not null,
    'services', services,
    'service_income', svc, 'tips', tips, 'income', svc + tips, 'expenses', exp, 'net', svc + tips - exp,
    'by_method', jsonb_build_object(
      'cash', jsonb_build_object('in', cash_in, 'out', cash_out, 'net', cash_in - cash_out),
      'transfer', jsonb_build_object('in', tr_in, 'out', tr_out, 'net', tr_in - tr_out),
      'card', jsonb_build_object('in', card_in, 'out', card_out, 'net', card_in - card_out),
      'other', jsonb_build_object('in', ot_in, 'out', ot_out, 'net', ot_in - ot_out)),
    'expected_cash', expected,
    'cash_lines', lines,
    'expenses_list', expense_list,
    'close', case when closed.id is null then null else jsonb_build_object(
      'counted', closed.counted_cash, 'expected', closed.expected_cash, 'difference', closed.difference,
      'notes', closed.notes, 'closed_at', closed.closed_at) end);
end $$;

create or replace function public.caja_periodo(p_business uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r member_role := _need_role(p_business, 'owner', 'admin', 'receptionist', 'barber');
  mine uuid := my_member_id(p_business);
  tz text; svc bigint; tips bigint; exp bigint; adv bigint;
  cash_in bigint; cash_out bigint; tr_in bigint; tr_out bigint; card_in bigint; card_out bigint; ot_in bigint; ot_out bigint;
  services jsonb; barbers jsonb;
begin
  if p_to < p_from then raise exception 'invalid_period'; end if;
  select timezone into tz from businesses where id = p_business;
  select coalesce(sum(subtotal - discount), 0)::bigint, coalesce(sum(tip), 0)::bigint into svc, tips
    from sales
    where business_id = p_business and status = 'paid'
      and (created_at at time zone tz)::date between p_from and p_to
      and (r <> 'barber' or member_id = mine);
  if r = 'barber' then
    exp := 0; adv := 0; cash_out := 0; tr_out := 0; card_out := 0; ot_out := 0;
  else
    select coalesce(sum(amount), 0)::bigint into exp from expenses
      where business_id = p_business and status = 'active' and occurred_on between p_from and p_to;
    select coalesce(sum(amount), 0)::bigint into adv from staff_advances
      where business_id = p_business and (given_at at time zone tz)::date between p_from and p_to;
    select coalesce(sum(amount) filter (where method = 'cash'), 0)::bigint,
           coalesce(sum(amount) filter (where method = 'transfer'), 0)::bigint,
           coalesce(sum(amount) filter (where method = 'card'), 0)::bigint,
           coalesce(sum(amount) filter (where method = 'other'), 0)::bigint
      into cash_out, tr_out, card_out, ot_out
      from expenses where business_id = p_business and status = 'active' and occurred_on between p_from and p_to;
  end if;
  select coalesce(sum(p.amount) filter (where p.method = 'cash'), 0)::bigint,
         coalesce(sum(p.amount) filter (where p.method = 'transfer'), 0)::bigint,
         coalesce(sum(p.amount) filter (where p.method = 'card'), 0)::bigint,
         coalesce(sum(p.amount) filter (where p.method = 'other'), 0)::bigint
    into cash_in, tr_in, card_in, ot_in
    from payments p join sales s on s.id = p.sale_id
    where s.business_id = p_business and s.status = 'paid'
      and (s.created_at at time zone tz)::date between p_from and p_to
      and (r <> 'barber' or s.member_id = mine);

  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'unit_price', unit_price, 'qty', qty, 'total', total) order by total desc, name), '[]'::jsonb)
    into services from (
      select si.name, si.unit_price, sum(si.qty)::int qty, sum(si.line_total)::bigint total
      from sale_items si join sales s on s.id = si.sale_id
      where s.business_id = p_business and s.status = 'paid' and si.item_type = 'service'
        and (s.created_at at time zone tz)::date between p_from and p_to
        and (r <> 'barber' or s.member_id = mine)
      group by si.name, si.unit_price
    ) x;

  select coalesce(jsonb_agg(row order by income desc, name), '[]'::jsonb) into barbers from (
    select jsonb_build_object(
      'id', m.id, 'name', m.display_name,
      'services', coalesce(q.services, 0),
      'income', coalesce(t.income, 0),
      'tips', coalesce(t.tips, 0),
      'commission', case when r in ('owner', 'admin') or m.id = mine then coalesce(c.commission, 0) else null end
    ) as row, coalesce(t.income, 0) as income, m.display_name as name
    from memberships m
    left join (
      select member_id, sum(subtotal - discount)::bigint income, sum(tip)::bigint tips
      from sales
      where business_id = p_business and status = 'paid' and (created_at at time zone tz)::date between p_from and p_to
      group by member_id
    ) t on t.member_id = m.id
    left join (
      select s.member_id, coalesce(sum(si.qty), 0)::int services
      from sales s join sale_items si on si.sale_id = s.id and si.item_type = 'service'
      where s.business_id = p_business and s.status = 'paid' and (s.created_at at time zone tz)::date between p_from and p_to
      group by s.member_id
    ) q on q.member_id = m.id
    left join (
      select member_id, sum(amount)::bigint commission
      from commission_entries
      where business_id = p_business and (occurred_at at time zone tz)::date between p_from and p_to
      group by member_id
    ) c on c.member_id = m.id
    where m.business_id = p_business
      and (r <> 'barber' or m.id = mine)
      and (coalesce(t.income, 0) <> 0 or coalesce(t.tips, 0) <> 0 or coalesce(c.commission, 0) <> 0)
  ) y;

  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'service_income', svc, 'tips', tips, 'income', svc + tips, 'expenses', exp, 'advances', adv, 'net', svc + tips - exp,
    'by_method', jsonb_build_object(
      'cash', jsonb_build_object('in', cash_in, 'out', cash_out, 'net', cash_in - cash_out),
      'transfer', jsonb_build_object('in', tr_in, 'out', tr_out, 'net', tr_in - tr_out),
      'card', jsonb_build_object('in', card_in, 'out', card_out, 'net', card_in - card_out),
      'other', jsonb_build_object('in', ot_in, 'out', ot_out, 'net', ot_in - ot_out)),
    'services', services,
    'barbers', barbers);
end $$;

revoke execute on function public._business_today(uuid), public._assert_day_open(uuid, date),
  public._ledger(uuid, ledger_type, int, bigint, pay_method, ledger_account, uuid, text, uuid, text, uuid, uuid, timestamptz),
  public._commit_sale(uuid, uuid, uuid, uuid, rule_item_type[], uuid[], text[], uuid[], int[], bigint[], bigint, bigint, jsonb),
  public._cash_lines(uuid, date, date)
  from public, anon, authenticated;

revoke execute on function public.attend_appointment(uuid, pay_method, bigint, bigint), public.mark_no_show(uuid),
  public.record_expense_on(uuid, bigint, pay_method, text, date),
  public.close_cash_day(uuid, date, bigint, text), public.caja_dia(uuid, date), public.caja_periodo(uuid, date, date),
  public.pay_settlement(uuid, uuid, date, date, pay_method)
  from public, anon;
grant execute on function public.attend_appointment(uuid, pay_method, bigint, bigint), public.mark_no_show(uuid),
  public.record_expense_on(uuid, bigint, pay_method, text, date),
  public.close_cash_day(uuid, date, bigint, text), public.caja_dia(uuid, date), public.caja_periodo(uuid, date, date),
  public.pay_settlement(uuid, uuid, date, date, pay_method)
  to authenticated;
