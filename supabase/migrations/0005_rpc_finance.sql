-- 0005: RPCs financieras (única vía de escritura para ventas, ledger, comisiones, caja, liquidaciones)

create or replace function public._method_es(m pay_method) returns text language sql immutable as $$
  select case m when 'cash' then 'efectivo' when 'card' then 'tarjeta' when 'transfer' then 'transferencia' else 'otro' end $$;
create or replace function public._account_of(m pay_method) returns ledger_account language sql immutable as $$
  select case m when 'cash' then 'cash'::ledger_account when 'card' then 'card_clearing' else 'bank' end $$;

create or replace function public._need_role(bid uuid, variadic roles member_role[]) returns member_role
language plpgsql stable security definer set search_path = public as $$
declare r member_role := my_role(bid);
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if r is null or not (r = any(roles)) then raise exception 'forbidden'; end if;
  return r;
end $$;

create or replace function public._ensure_session(bid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  select id into sid from cash_sessions where business_id = bid and status = 'open';
  if sid is null then
    insert into cash_sessions(business_id, opened_by, opening_float) values (bid, auth.uid(), 0) returning id into sid;
  end if;
  return sid;
end $$;

create or replace function public._ledger(bid uuid, p_type ledger_type, p_dir int, p_amount bigint, p_method pay_method,
  p_account ledger_account, p_member uuid, p_src text, p_src_id uuid, p_desc text, p_session uuid, p_reversal_of uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare id uuid;
begin
  insert into ledger_entries(business_id, type, direction, amount, method, account, member_id, source_table, source_id,
                             description, cash_session_id, created_by, reversal_of)
  values (bid, p_type, p_dir, p_amount, p_method, p_account, p_member, p_src, p_src_id, p_desc, p_session, auth.uid(), p_reversal_of)
  returning ledger_entries.id into id;
  return id;
end $$;

-- Regla ganadora: miembro+ítem > miembro > ítem > negocio (espejo de src/lib/commission.ts)
create or replace function public._pick_rule(bid uuid, p_member uuid, p_type rule_item_type, p_item uuid, p_date date)
returns table(rule commission_rules, score int) language sql stable security definer set search_path = public as $$
  select r, case when r.member_id is not null and r.item_id is not null then 4 when r.member_id is not null then 3
                 when r.item_id is not null then 2 else 1 end
  from commission_rules r
  where r.business_id = bid and r.item_type = p_type
    and (r.member_id is null or r.member_id = p_member) and (r.item_id is null or r.item_id = p_item)
    and (r.valid_from is null or r.valid_from <= p_date) and (r.valid_to is null or r.valid_to >= p_date)
  order by 2 desc, coalesce(r.valid_from, '0001-01-01'::date) desc, r.id desc limit 1
$$;

create or replace function public._add_commission(bid uuid, p_sale sales, p_item sale_items, p_type rule_item_type,
  p_member uuid, p_desc text, p_qty int, p_unit bigint, p_discount bigint, p_item_ref uuid, p_date date, p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pr record; gross bigint := p_qty * p_unit; disc bigint := case when p_type = 'tip' then 0 else p_discount end;
        base bigint; amt bigint := 0; snap jsonb; scope text; cid uuid;
begin
  select * into pr from _pick_rule(bid, p_member, p_type, p_item_ref, p_date);
  if pr.rule is null then
    base := 0;
    snap := jsonb_build_object('rule', null, 'description', p_desc, 'item_type', p_type, 'qty', p_qty, 'gross', gross, 'discount', disc, 'base_amount', 0);
  else
    base := case when (pr.rule).base = 'gross' then gross else gross - disc end;
    amt := case when (pr.rule).kind = 'percent' then floor(base * (pr.rule).value / 100 + 0.5)::bigint
                else round((pr.rule).value * p_qty)::bigint end;
    scope := (array['business','business','item','member','member_item'])[pr.score + 1];
    snap := jsonb_build_object(
      'rule', jsonb_build_object('id', (pr.rule).id, 'member_id', (pr.rule).member_id, 'item_type', (pr.rule).item_type,
              'item_id', (pr.rule).item_id, 'kind', (pr.rule).kind, 'value', (pr.rule).value, 'base', (pr.rule).base, 'scope', scope),
      'description', p_desc, 'item_type', p_type, 'qty', p_qty, 'gross', gross, 'discount', disc, 'base_amount', base);
  end if;
  insert into commission_entries(business_id, member_id, sale_id, sale_item_id, item_type, description, rule_id, base_amount, rule_snapshot, amount)
    values (bid, p_member, p_sale.id, p_item.id, p_type, p_desc, (pr.rule).id, base, snap, amt) returning id into cid;
  if amt <> 0 then
    perform _ledger(bid, 'commission_accrual', 1, amt, null, 'payable_staff', p_member, 'sales', p_sale.id,
      format('Comisión venta #%s · %s', p_sale.number, p_desc), p_session);
  end if;
end $$;

-- ===== COBRAR =====
-- p_items: [{item_type:'service'|'product', item_id, qty?, member_id?, unit_price? (solo owner/admin/recepción)}]
-- p_payments: [{method:'cash'|'card'|'transfer'|'other', amount, reference?}]
create or replace function public.pay_sale(p_business uuid, p_appointment uuid, p_client uuid, p_member uuid,
  p_items jsonb, p_discount bigint, p_tip bigint, p_payments jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r member_role := _need_role(p_business, 'owner','admin','receptionist','barber');
  mine uuid := my_member_id(p_business);
  b businesses; sale sales; sid uuid; sess uuid; num int; appt appointments;
  n int; i int; it jsonb; ord int;
  types rule_item_type[] := '{}'; ids uuid[] := '{}'; names text[] := '{}'; mems uuid[] := '{}';
  qtys int[] := '{}'; prices bigint[] := '{}'; allocs bigint[] := '{}';
  v_item uuid; v_mem uuid; v_qty int; v_price bigint; v_name text; v_type rule_item_type;
  gross_total bigint := 0; d bigint; rest bigint; add bigint; sub bigint; tip bigint := greatest(coalesce(p_tip,0),0);
  paid bigint := 0; income bigint; income_left bigint; pay jsonb; amt bigint; to_inc bigint; meth pay_method;
  today date; sale_item_ids uuid[] := '{}'; sii uuid; si sale_items; desc_items text;
begin
  select * into b from businesses where id = p_business;
  today := (now() at time zone b.timezone)::date;
  if not exists (select 1 from memberships where id = p_member and business_id = p_business) then raise exception 'invalid_member'; end if;
  if r = 'barber' and p_member <> mine then raise exception 'forbidden'; end if;
  if p_appointment is not null then
    select * into appt from appointments where id = p_appointment and business_id = p_business;
    if not found then raise exception 'appointment_not_found'; end if;
    if r = 'barber' and appt.member_id <> mine then raise exception 'forbidden'; end if;
  end if;
  if p_client is not null and not exists (select 1 from clients where id = p_client and business_id = p_business) then raise exception 'invalid_client'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty_sale'; end if;

  -- 1) resolver líneas con precios del servidor
  for it in select * from jsonb_array_elements(p_items) loop
    v_type := (it->>'item_type')::rule_item_type;
    v_item := (it->>'item_id')::uuid;
    v_qty := coalesce((it->>'qty')::int, 1);
    v_mem := coalesce((it->>'member_id')::uuid, p_member);
    if r = 'barber' then v_mem := mine; end if;
    if v_qty < 1 or v_qty > 100 then raise exception 'invalid_qty'; end if;
    if not exists (select 1 from memberships where id = v_mem and business_id = p_business) then raise exception 'invalid_member'; end if;
    if v_type = 'service' then
      select s.name, coalesce(ms.price_override, s.price) into v_name, v_price from services s
        left join member_services ms on ms.service_id = s.id and ms.member_id = v_mem
        where s.id = v_item and s.business_id = p_business and s.active;
    elsif v_type = 'product' then
      select name, price into v_name, v_price from products where id = v_item and business_id = p_business and active;
    else raise exception 'invalid_item_type'; end if;
    if v_name is null then raise exception 'item_not_found'; end if;
    if r <> 'barber' and it ? 'unit_price' then v_price := (it->>'unit_price')::bigint; end if;
    if v_price < 0 then raise exception 'invalid_price'; end if;
    types := types || v_type; ids := ids || v_item; names := names || v_name; mems := mems || v_mem;
    qtys := qtys || v_qty; prices := prices || v_price; gross_total := gross_total + v_qty * v_price;
    v_name := null;
  end loop;
  n := array_length(types, 1);

  -- 2) descuento proporcional (resto a las últimas líneas)
  d := least(greatest(coalesce(p_discount,0), 0), gross_total);
  rest := d;
  for i in 1..n loop
    allocs := allocs || (case when gross_total = 0 then 0 else (qtys[i] * prices[i] * d) / gross_total end)::bigint;
    rest := rest - allocs[i];
  end loop;
  for i in reverse n..1 loop
    exit when rest <= 0;
    add := least(qtys[i] * prices[i] - allocs[i], rest);
    allocs[i] := allocs[i] + add; rest := rest - add;
  end loop;
  income := gross_total - d;

  -- 3) validar pagos
  for pay in select * from jsonb_array_elements(coalesce(p_payments, '[]')) loop
    if (pay->>'amount')::bigint <= 0 then raise exception 'invalid_payment'; end if;
    paid := paid + (pay->>'amount')::bigint;
  end loop;
  if income + tip <= 0 then raise exception 'empty_sale'; end if;
  if paid <> income + tip then raise exception 'payments_mismatch: pagos % vs total %', paid, income + tip; end if;

  -- 4) venta
  update businesses set sale_seq = sale_seq + 1 where id = p_business returning sale_seq into num;
  sess := _ensure_session(p_business);
  insert into sales(business_id, number, appointment_id, client_id, member_id, status, subtotal, discount, tip, total, cash_session_id, created_by)
    values (p_business, num, p_appointment, coalesce(p_client, appt.client_id), p_member, 'paid', gross_total, d, tip, income + tip, sess, auth.uid())
    returning * into sale;
  for i in 1..n loop
    insert into sale_items(business_id, sale_id, item_type, item_id, name, member_id, qty, unit_price, discount, line_total)
      values (p_business, sale.id, types[i], ids[i], names[i], mems[i], qtys[i], prices[i], allocs[i], qtys[i] * prices[i] - allocs[i])
      returning id into sii;
    sale_item_ids := sale_item_ids || sii;
  end loop;
  for pay in select * from jsonb_array_elements(p_payments) loop
    insert into payments(business_id, sale_id, method, amount, reference)
      values (p_business, sale.id, (pay->>'method')::pay_method, (pay->>'amount')::bigint, pay->>'reference');
  end loop;

  -- 5) ledger: pagos en orden cubren primero ingreso, el resto es propina
  select string_agg(distinct x, ', ') into desc_items from unnest(names) x;
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

  -- 6) comisiones línea a línea (+ propina)
  for i in 1..n loop
    select * into si from sale_items where id = sale_item_ids[i];
    perform _add_commission(p_business, sale, si, types[i], mems[i], names[i], qtys[i], prices[i], allocs[i], ids[i], today, sess);
  end loop;
  if tip > 0 then
    perform _add_commission(p_business, sale, null, 'tip', p_member, 'Propina', 1, tip, 0, null, today, sess);
  end if;
  if p_appointment is not null then
    update appointments set status = 'completed' where id = p_appointment and status not in ('cancelled');
  end if;
  return sale.id;
end $$;

-- ===== ANULAR (reversa, nunca borrar) =====
create or replace function public._do_void_sale(p_sale uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare s sales; sess uuid; e ledger_entries; c commission_entries;
begin
  select * into s from sales where id = p_sale for update;
  if not found then raise exception 'sale_not_found'; end if;
  if s.status <> 'paid' then raise exception 'sale_not_paid'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'reason_required'; end if;
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

create or replace function public.void_sale(p_sale uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  select business_id into bid from sales where id = p_sale;
  perform _need_role(bid, 'owner', 'admin');
  perform _do_void_sale(p_sale, p_reason);
end $$;

create or replace function public.request_void_sale(p_sale uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare s sales; r member_role; id uuid;
begin
  select * into s from sales where id = p_sale;
  if not found then raise exception 'sale_not_found'; end if;
  r := _need_role(s.business_id, 'receptionist', 'barber');
  if r = 'barber' and s.member_id <> my_member_id(s.business_id) then raise exception 'forbidden'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'reason_required'; end if;
  insert into void_requests(business_id, sale_id, requested_by, reason) values (s.business_id, p_sale, auth.uid(), p_reason) returning void_requests.id into id;
  return id;
end $$;

create or replace function public.decide_void_request(p_request uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v void_requests;
begin
  select * into v from void_requests where id = p_request and status = 'pending';
  if not found then raise exception 'request_not_found'; end if;
  perform _need_role(v.business_id, 'owner', 'admin');
  if p_approve then perform _do_void_sale(v.sale_id, v.reason);
  else update void_requests set status = 'rejected', decided_by = auth.uid(), decided_at = now() where id = p_request; end if;
end $$;

-- ===== GASTOS =====
create or replace function public.record_expense(p_business uuid, p_category uuid, p_amount bigint, p_method pay_method,
  p_description text, p_receipt_url text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare r member_role := _need_role(p_business, 'owner', 'admin', 'receptionist'); id uuid; sess uuid; b businesses; lim bigint;
begin
  select * into b from businesses where id = p_business;
  lim := coalesce((b.settings->>'receptionist_expense_limit')::bigint, 200000);
  if r = 'receptionist' and p_amount > lim then raise exception 'expense_over_limit'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  if length(trim(coalesce(p_description,''))) < 2 then raise exception 'description_required'; end if;
  if p_category is not null and not exists (select 1 from expense_categories where id = p_category and business_id = p_business) then raise exception 'invalid_category'; end if;
  sess := _ensure_session(p_business);
  insert into expenses(business_id, category_id, amount, method, description, receipt_url, cash_session_id, created_by)
    values (p_business, p_category, p_amount, p_method, trim(p_description), p_receipt_url, sess, auth.uid()) returning expenses.id into id;
  perform _ledger(p_business, 'expense', -1, p_amount, p_method, _account_of(p_method), null, 'expenses', id,
    format('Gasto: %s (%s)', trim(p_description), _method_es(p_method)), sess);
  return id;
end $$;

create or replace function public.void_expense(p_expense uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare x expenses; e ledger_entries; sess uuid;
begin
  select * into x from expenses where id = p_expense for update;
  if not found then raise exception 'expense_not_found'; end if;
  perform _need_role(x.business_id, 'owner', 'admin');
  if x.status <> 'active' then raise exception 'already_voided'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'reason_required'; end if;
  sess := _ensure_session(x.business_id);
  update expenses set status = 'voided', void_reason = p_reason, voided_by = auth.uid() where id = p_expense;
  for e in select * from ledger_entries where source_table = 'expenses' and source_id = p_expense and reversal_of is null loop
    perform _ledger(x.business_id, 'void_reversal', -e.direction, e.amount, e.method, e.account, e.member_id, 'expenses', p_expense,
      format('Anulación gasto: %s (motivo: %s)', x.description, p_reason), sess, e.id);
  end loop;
end $$;

-- ===== CAJA =====
create or replace function public.open_cash_session(p_business uuid, p_float bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare id uuid;
begin
  perform _need_role(p_business, 'owner', 'admin', 'receptionist');
  if p_float < 0 then raise exception 'invalid_amount'; end if;
  if exists (select 1 from cash_sessions where business_id = p_business and status = 'open') then raise exception 'session_already_open'; end if;
  insert into cash_sessions(business_id, opened_by, opening_float) values (p_business, auth.uid(), p_float) returning cash_sessions.id into id;
  return id;
end $$;

create or replace function public.close_cash_session(p_session uuid, p_counted bigint, p_denominations jsonb default null, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s cash_sessions; exp bigint; diff bigint;
begin
  select * into s from cash_sessions where id = p_session for update;
  if not found then raise exception 'session_not_found'; end if;
  perform _need_role(s.business_id, 'owner', 'admin', 'receptionist');
  if s.status <> 'open' then raise exception 'session_closed'; end if;
  if p_counted is null or p_counted < 0 then raise exception 'invalid_amount'; end if;
  select s.opening_float + coalesce(sum(direction * amount), 0) into exp
    from ledger_entries where cash_session_id = p_session and account = 'cash';
  diff := p_counted - exp;
  if diff <> 0 and length(trim(coalesce(p_notes,''))) < 3 then raise exception 'note_required'; end if;
  update cash_sessions set status = 'closed', closed_by = auth.uid(), closed_at = now(), expected_cash = exp,
    counted_cash = p_counted, difference = diff, denominations = p_denominations, notes = p_notes where id = p_session;
  return jsonb_build_object('expected', exp, 'counted', p_counted, 'difference', diff);
end $$;

-- ===== PERSONAL: adelantos y liquidaciones =====
create or replace function public.register_advance(p_business uuid, p_member uuid, p_amount bigint, p_method pay_method, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare id uuid; sess uuid; nm text;
begin
  perform _need_role(p_business, 'owner', 'admin');
  select display_name into nm from memberships where id = p_member and business_id = p_business;
  if nm is null then raise exception 'invalid_member'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  sess := case when p_method = 'cash' then _ensure_session(p_business) end;
  insert into staff_advances(business_id, member_id, amount, method, note, created_by)
    values (p_business, p_member, p_amount, p_method, p_note, auth.uid()) returning staff_advances.id into id;
  perform _ledger(p_business, 'payout', -1, p_amount, p_method, _account_of(p_method), p_member, 'staff_advances', id, format('Adelanto a %s (%s)', nm, _method_es(p_method)), sess);
  perform _ledger(p_business, 'payout', -1, p_amount, null, 'payable_staff', p_member, 'staff_advances', id, format('Adelanto a %s: descuenta lo que se le debe', nm), null);
  return id;
end $$;

create or replace function public._recalc_payout(p_payout uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update payouts p set
    commission_total = coalesce((select sum(amount) from payout_lines where payout_id = p.id and kind = 'commission'), 0),
    adjustments = coalesce((select sum(amount) from payout_lines where payout_id = p.id and kind = 'adjustment'), 0),
    advances = coalesce((select sum(amount) from payout_lines where payout_id = p.id and kind = 'advance'), 0)
  where p.id = p_payout;
  update payouts set total = commission_total + fixed_amount + adjustments - advances where id = p_payout;
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
  perform _recalc_payout(pid);
  return pid;
exception when unique_violation then
  raise exception 'draft_already_exists';
end $$;

create or replace function public.add_payout_adjustment(p_payout uuid, p_amount bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare p payouts;
begin
  select * into p from payouts where id = p_payout for update;
  if not found then raise exception 'payout_not_found'; end if;
  perform _need_role(p.business_id, 'owner', 'admin');
  if p.status <> 'draft' then raise exception 'payout_not_draft'; end if;
  if p_amount is null or p_amount = 0 or length(trim(coalesce(p_reason,''))) < 3 then raise exception 'reason_required'; end if;
  insert into payout_lines(business_id, payout_id, kind, description, amount) values (p.business_id, p_payout, 'adjustment', trim(p_reason), p_amount);
  perform _recalc_payout(p_payout);
end $$;

create or replace function public.discard_payout(p_payout uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p payouts;
begin
  select * into p from payouts where id = p_payout for update;
  perform _need_role(p.business_id, 'owner', 'admin');
  if p.status <> 'draft' then raise exception 'payout_not_draft'; end if;
  delete from payouts where id = p_payout;
end $$;

create or replace function public.approve_payout(p_payout uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p payouts; net bigint; nm text;
begin
  select * into p from payouts where id = p_payout for update;
  if not found then raise exception 'payout_not_found'; end if;
  perform _need_role(p.business_id, 'owner');
  if p.status <> 'draft' then raise exception 'payout_not_draft'; end if;
  select display_name into nm from memberships where id = p.member_id;
  net := p.fixed_amount + p.adjustments;
  if net <> 0 then
    perform _ledger(p.business_id, 'salary_accrual', case when net > 0 then 1 else -1 end, abs(net), null, 'payable_staff', p.member_id, 'payouts', p.id,
      format('Sueldo fijo + ajustes %s (%s a %s)', nm, p.period_start, p.period_end), null);
  end if;
  update payouts set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_payout;
end $$;

create or replace function public.pay_payout(p_payout uuid, p_method pay_method) returns void
language plpgsql security definer set search_path = public as $$
declare p payouts; sess uuid; nm text;
begin
  select * into p from payouts where id = p_payout for update;
  if not found then raise exception 'payout_not_found'; end if;
  perform _need_role(p.business_id, 'owner', 'admin');
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

-- ===== MENSAJES =====
create or replace function public.schedule_message(p_business uuid, p_client uuid, p_body text, p_send_at timestamptz) returns uuid
language plpgsql security definer set search_path = public as $$
declare c clients; id uuid;
begin
  perform _need_role(p_business, 'owner', 'admin', 'receptionist');
  select * into c from clients where id = p_client and business_id = p_business;
  if not found then raise exception 'invalid_client'; end if;
  if not c.whatsapp_opt_in then raise exception 'client_no_opt_in'; end if;
  if c.phone is null then raise exception 'client_no_phone'; end if;
  if length(trim(coalesce(p_body,''))) < 1 then raise exception 'body_required'; end if;
  insert into scheduled_messages(business_id, client_id, kind, to_phone, payload, send_at, created_by)
    values (p_business, p_client, 'custom', c.phone, jsonb_build_object('body', p_body), p_send_at, auth.uid()) returning scheduled_messages.id into id;
  return id;
end $$;

-- Solo service_role (cron / Edge Function): toma mensajes vencidos con SKIP LOCKED.
create or replace function public.claim_due_messages(p_limit integer default 20) returns setof scheduled_messages
language sql security definer set search_path = public as $$
  update scheduled_messages m set status = 'sending', attempts = attempts + 1
  where m.id in (select id from scheduled_messages where status = 'pending' and send_at <= now()
                 order by send_at limit p_limit for update skip locked)
  returning m.*
$$;
create or replace function public.mark_message_result(p_id uuid, p_ok boolean, p_provider_msg_id text default null, p_error text default null) returns void
language plpgsql security definer set search_path = public as $$
declare m scheduled_messages;
begin
  select * into m from scheduled_messages where id = p_id;
  if p_ok then
    update scheduled_messages set status = 'sent', provider_msg_id = p_provider_msg_id, error = null where id = p_id;
  elsif m.attempts >= 3 then
    update scheduled_messages set status = 'failed', error = p_error where id = p_id;
  else  -- reintento con backoff 5, 10 min…
    update scheduled_messages set status = 'pending', error = p_error, send_at = now() + make_interval(mins => 5 * m.attempts) where id = p_id;
  end if;
end $$;
