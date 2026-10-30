-- 0007: Recepción ve SOLO los asientos de la caja abierta (turno actual), para poder cerrarla
-- con el "ver cálculo". No ve el libro completo ni cajas cerradas.
create or replace function public.is_open_session(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from cash_sessions where id = p_session and status = 'open')
$$;
grant execute on function is_open_session(uuid) to authenticated;
create policy ledger_sel_shift on ledger_entries for select to authenticated using (
  has_role(business_id, 'receptionist') and cash_session_id is not null and account = 'cash' and is_open_session(cash_session_id));
