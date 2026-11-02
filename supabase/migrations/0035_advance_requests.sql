-- Solicitudes de adelanto: el barbero (o recepción) pide, el dueño o admin aprueba o rechaza.
-- Al aprobar se usa register_advance, así el dinero pasa por la caja y se descuenta de lo que se le debe, como siempre.
create table if not exists advance_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  member_id uuid not null references memberships(id) on delete cascade,
  amount bigint not null check (amount > 0 and amount <= 100000000),
  note text check (note is null or char_length(note) <= 200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  advance_id uuid references staff_advances(id)
);
create index if not exists advance_requests_biz_status on advance_requests(business_id, status, requested_at desc);
-- Una sola solicitud pendiente por persona: evita pedir muchas veces seguidas.
create unique index if not exists advance_one_pending on advance_requests(member_id) where status = 'pending';

alter table advance_requests enable row level security;
revoke all on advance_requests from public, anon, authenticated;
grant select on advance_requests to authenticated;
drop policy if exists advreq_sel on advance_requests;
create policy advreq_sel on advance_requests for select to authenticated
  using (has_role(business_id, 'owner', 'admin') or member_id = my_member_id(business_id));

-- El barbero o recepción pide un adelanto para sí mismo.
create or replace function public.request_advance(p_amount bigint, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := require_auth(); m memberships; rid uuid;
begin
  select * into m from memberships where user_id = uid and active and role in ('barber', 'receptionist') order by created_at limit 1;
  if not found then raise exception 'forbidden'; end if;
  perform _need_role(m.business_id, 'barber', 'receptionist');
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then raise exception 'invalid_amount'; end if;
  if exists (select 1 from advance_requests where member_id = m.id and status = 'pending') then raise exception 'request_pending'; end if;
  insert into advance_requests(business_id, member_id, amount, note)
    values (m.business_id, m.id, p_amount, nullif(left(trim(coalesce(p_note, '')), 200), '')) returning id into rid;
  return rid;
end $$;

-- El dueño o admin aprueba (con el método de pago) o rechaza.
create or replace function public.decide_advance_request(p_request uuid, p_approve boolean, p_method pay_method default 'cash', p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r advance_requests; aid uuid;
begin
  select * into r from advance_requests where id = p_request for update;
  if not found then raise exception 'request_not_found'; end if;
  perform _need_role(r.business_id, 'owner', 'admin');
  if r.status <> 'pending' then raise exception 'request_closed'; end if;
  if p_approve then
    aid := register_advance(r.business_id, r.member_id, r.amount, p_method, coalesce(nullif(trim(p_note), ''), r.note));
    update advance_requests set status = 'approved', decided_at = now(), decided_by = auth.uid(), advance_id = aid where id = p_request;
  else
    update advance_requests set status = 'rejected', decided_at = now(), decided_by = auth.uid() where id = p_request;
  end if;
end $$;

-- Quien pidió puede cancelar su solicitud mientras siga pendiente.
create or replace function public.cancel_advance_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r advance_requests;
begin
  select * into r from advance_requests where id = p_request for update;
  if not found then raise exception 'request_not_found'; end if;
  if r.member_id is distinct from my_member_id(r.business_id) then raise exception 'forbidden'; end if;
  if r.status <> 'pending' then raise exception 'request_closed'; end if;
  update advance_requests set status = 'cancelled', decided_at = now(), decided_by = auth.uid() where id = p_request;
end $$;

revoke all on function public.request_advance(bigint, text), public.decide_advance_request(uuid, boolean, pay_method, text), public.cancel_advance_request(uuid) from public, anon;
grant execute on function public.request_advance(bigint, text), public.decide_advance_request(uuid, boolean, pay_method, text), public.cancel_advance_request(uuid) to authenticated;
