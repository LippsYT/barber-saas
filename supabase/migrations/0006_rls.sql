-- 0006: RLS + permisos. La UI solo oculta; la seguridad vive aquí.
-- Matriz: M = owner/admin · R = receptionist · B = barber (solo lo propio)

do $$
declare t text;
begin
  foreach t in array array['businesses','profiles','memberships','member_compensation','working_hours','time_off','services',
    'member_services','products','clients','appointments','appointment_items','cash_sessions','sales','sale_items','payments',
    'expense_categories','expenses','ledger_entries','commission_rules','commission_entries','staff_advances','payouts',
    'payout_lines','void_requests','audit_log','message_templates','scheduled_messages']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---- negocio y equipo
create policy businesses_sel on businesses for select to authenticated using (is_member(id));
create policy businesses_upd on businesses for update to authenticated using (has_role(id, 'owner')) with check (has_role(id, 'owner'));

create policy profiles_sel on profiles for select to authenticated using (
  id = auth.uid() or exists (select 1 from memberships a join memberships b on a.business_id = b.business_id
                             where a.user_id = auth.uid() and a.active and b.user_id = profiles.id));
create policy profiles_ins on profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_upd on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy memberships_sel on memberships for select to authenticated using (is_member(business_id));
create policy memberships_ins on memberships for insert to authenticated with check (
  has_role(business_id, 'owner') or (has_role(business_id, 'admin') and role in ('receptionist','barber')));
create policy memberships_upd on memberships for update to authenticated
  using (has_role(business_id, 'owner') or (has_role(business_id, 'admin') and role in ('receptionist','barber')))
  with check (has_role(business_id, 'owner') or (has_role(business_id, 'admin') and role in ('receptionist','barber')));

create policy comp_sel on member_compensation for select to authenticated using (
  has_role(business_id, 'owner', 'admin') or member_id = my_member_id(business_id));
create policy comp_upd on member_compensation for update to authenticated
  using (has_role(business_id, 'owner', 'admin')) with check (has_role(business_id, 'owner', 'admin'));

-- ---- agenda
create policy wh_sel on working_hours for select to authenticated using (is_member(business_id));
create policy wh_all on working_hours for all to authenticated
  using (has_role(business_id, 'owner', 'admin')) with check (has_role(business_id, 'owner', 'admin'));
create policy to_sel on time_off for select to authenticated using (is_member(business_id));
create policy to_all on time_off for all to authenticated
  using (has_role(business_id, 'owner', 'admin', 'receptionist') or member_id = my_member_id(business_id))
  with check (has_role(business_id, 'owner', 'admin', 'receptionist') or member_id = my_member_id(business_id));

create policy svc_sel on services for select to authenticated using (is_member(business_id));
create policy svc_all on services for all to authenticated
  using (has_role(business_id, 'owner', 'admin')) with check (has_role(business_id, 'owner', 'admin'));
create policy ms_sel on member_services for select to authenticated using (is_member(business_id));
create policy ms_all on member_services for all to authenticated
  using (has_role(business_id, 'owner', 'admin')) with check (has_role(business_id, 'owner', 'admin'));
create policy prod_sel on products for select to authenticated using (is_member(business_id));
create policy prod_all on products for all to authenticated
  using (has_role(business_id, 'owner', 'admin')) with check (has_role(business_id, 'owner', 'admin'));

create policy clients_sel on clients for select to authenticated using (is_member(business_id));
create policy clients_ins on clients for insert to authenticated with check (is_member(business_id));
create policy clients_upd on clients for update to authenticated using (is_member(business_id)) with check (is_member(business_id));
create policy clients_del on clients for delete to authenticated using (has_role(business_id, 'owner', 'admin'));

create policy appt_sel on appointments for select to authenticated using (
  has_role(business_id, 'owner', 'admin', 'receptionist') or member_id = my_member_id(business_id));
create policy appt_ins on appointments for insert to authenticated with check (
  has_role(business_id, 'owner', 'admin', 'receptionist') or member_id = my_member_id(business_id));
create policy appt_upd on appointments for update to authenticated
  using (has_role(business_id, 'owner', 'admin', 'receptionist') or member_id = my_member_id(business_id))
  with check (has_role(business_id, 'owner', 'admin', 'receptionist') or member_id = my_member_id(business_id));
create policy appti_all on appointment_items for all to authenticated
  using (exists (select 1 from appointments a where a.id = appointment_id))
  with check (exists (select 1 from appointments a where a.id = appointment_id));

-- ---- dinero: lectura solamente; escritura vía RPC security definer
create policy cash_sel on cash_sessions for select to authenticated using (has_role(business_id, 'owner', 'admin', 'receptionist'));
create policy sales_sel on sales for select to authenticated using (
  has_role(business_id, 'owner', 'admin', 'receptionist') or member_id = my_member_id(business_id));
create policy sitems_sel on sale_items for select to authenticated using (exists (select 1 from sales s where s.id = sale_id));
create policy pay_sel on payments for select to authenticated using (exists (select 1 from sales s where s.id = sale_id));
create policy expcat_sel on expense_categories for select to authenticated using (has_role(business_id, 'owner', 'admin', 'receptionist'));
create policy expcat_all on expense_categories for all to authenticated
  using (has_role(business_id, 'owner', 'admin')) with check (has_role(business_id, 'owner', 'admin'));
create policy exp_sel on expenses for select to authenticated using (has_role(business_id, 'owner', 'admin', 'receptionist'));
create policy ledger_sel on ledger_entries for select to authenticated using (has_role(business_id, 'owner', 'admin'));

create policy rules_sel on commission_rules for select to authenticated using (
  has_role(business_id, 'owner', 'admin') or member_id = my_member_id(business_id));
create policy rules_all on commission_rules for all to authenticated
  using (has_role(business_id, 'owner', 'admin')) with check (has_role(business_id, 'owner', 'admin'));
create policy comm_sel on commission_entries for select to authenticated using (
  has_role(business_id, 'owner', 'admin') or member_id = my_member_id(business_id));
create policy adv_sel on staff_advances for select to authenticated using (
  has_role(business_id, 'owner', 'admin') or member_id = my_member_id(business_id));
create policy payouts_sel on payouts for select to authenticated using (
  has_role(business_id, 'owner', 'admin') or member_id = my_member_id(business_id));
create policy plines_sel on payout_lines for select to authenticated using (exists (select 1 from payouts p where p.id = payout_id));
create policy void_sel on void_requests for select to authenticated using (
  has_role(business_id, 'owner', 'admin') or requested_by = auth.uid());
create policy audit_sel on audit_log for select to authenticated using (has_role(business_id, 'owner', 'admin'));

-- ---- mensajes
create policy tpl_sel on message_templates for select to authenticated using (has_role(business_id, 'owner', 'admin', 'receptionist'));
create policy tpl_all on message_templates for all to authenticated
  using (has_role(business_id, 'owner', 'admin')) with check (has_role(business_id, 'owner', 'admin'));
create policy msg_sel on scheduled_messages for select to authenticated using (has_role(business_id, 'owner', 'admin', 'receptionist'));
create policy msg_upd on scheduled_messages for update to authenticated
  using (has_role(business_id, 'owner', 'admin', 'receptionist') and status = 'pending')
  with check (status = 'cancelled'); -- solo se puede cancelar un pendiente

-- ===== GRANTS =====
grant usage on schema public to anon, authenticated, service_role;
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
-- escritura directa solo donde hay policy de escritura
grant insert, update on businesses, memberships, profiles, member_compensation to authenticated;
revoke insert on businesses, member_compensation from authenticated;
grant insert, update, delete on working_hours, time_off, services, member_services, products, appointment_items,
  commission_rules, expense_categories, message_templates to authenticated;
grant insert, update on appointments to authenticated;
grant insert, update, delete on clients to authenticated;
grant update (status) on scheduled_messages to authenticated;
-- ledger/commission/sales/etc.: SOLO select (arriba) → nadie puede UPDATE/DELETE; además hay triggers.
grant all on all tables in schema public to service_role;

-- Funciones: nada por defecto; abrir una a una.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function is_member(uuid), my_role(uuid), my_member_id(uuid), has_role(uuid, member_role[]) to authenticated;
grant execute on function create_business(text, text, text, text, text, boolean), claim_my_invitations(),
  pay_sale(uuid, uuid, uuid, uuid, jsonb, bigint, bigint, jsonb), void_sale(uuid, text), request_void_sale(uuid, text),
  decide_void_request(uuid, boolean), record_expense(uuid, uuid, bigint, pay_method, text, text), void_expense(uuid, text),
  open_cash_session(uuid, bigint), close_cash_session(uuid, bigint, jsonb, text),
  register_advance(uuid, uuid, bigint, pay_method, text), generate_payout(uuid, uuid, date, date),
  add_payout_adjustment(uuid, bigint, text), discard_payout(uuid), approve_payout(uuid), pay_payout(uuid, pay_method),
  schedule_message(uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public_get_catalog(text), public_get_availability(text, uuid, uuid[], date),
  public_create_booking(text, uuid, uuid[], timestamptz, text, text, boolean, text),
  public_get_booking(text), public_cancel_booking(text) to anon, authenticated;
grant execute on function claim_due_messages(integer), mark_message_result(uuid, boolean, text, text) to service_role;
