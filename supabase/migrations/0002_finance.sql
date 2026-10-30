-- 0002_finance: ventas, pagos, caja, gastos, ledger inmutable, comisiones, liquidaciones, auditoría
create type sale_status as enum ('open','paid','voided');
create type pay_method as enum ('cash','card','transfer','other');
create type ledger_type as enum (
  'sale_income','tip_income','refund','void_reversal','expense','commission_accrual',
  'salary_accrual','payout','cash_in','cash_out','opening_float','adjustment');
create type ledger_account as enum ('cash','bank','card_clearing','payable_staff');
create type rule_item_type as enum ('service','product','tip');
create type payout_status as enum ('draft','approved','paid');

create table cash_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  opened_by uuid, opened_at timestamptz not null default now(),
  opening_float bigint not null default 0 check (opening_float >= 0),
  closed_by uuid, closed_at timestamptz,
  expected_cash bigint, counted_cash bigint, difference bigint,
  denominations jsonb, notes text,
  status text not null default 'open' check (status in ('open','closed'))
);
create unique index cash_one_open on cash_sessions(business_id) where status = 'open';

create table sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  number integer not null,
  appointment_id uuid references appointments(id),
  client_id uuid references clients(id),
  member_id uuid not null references memberships(id),
  status sale_status not null default 'paid',
  subtotal bigint not null, discount bigint not null default 0, tip bigint not null default 0, total bigint not null,
  cash_session_id uuid references cash_sessions(id),
  created_by uuid, created_at timestamptz not null default now(),
  voided_by uuid, voided_at timestamptz, void_reason text,
  unique (business_id, number),
  check (total = subtotal - discount + tip)
);
create unique index sales_one_paid_per_appt on sales(appointment_id) where appointment_id is not null and status = 'paid';
create index on sales(business_id, created_at);
create index on sales(member_id, created_at);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  sale_id uuid not null references sales(id) on delete cascade,
  item_type rule_item_type not null check (item_type in ('service','product')),
  item_id uuid,
  name text not null,
  member_id uuid not null references memberships(id),
  qty integer not null check (qty > 0),
  unit_price bigint not null check (unit_price >= 0),
  discount bigint not null default 0 check (discount >= 0),
  line_total bigint not null,
  check (line_total = qty * unit_price - discount)
);
create index on sale_items(sale_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  sale_id uuid not null references sales(id) on delete cascade,
  method pay_method not null,
  amount bigint not null check (amount > 0),
  reference text
);
create index on payments(sale_id);

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  unique (business_id, name)
);
create table expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  category_id uuid references expense_categories(id),
  amount bigint not null check (amount > 0),
  method pay_method not null,
  description text not null,
  receipt_url text,
  cash_session_id uuid references cash_sessions(id),
  status text not null default 'active' check (status in ('active','voided')),
  void_reason text, voided_by uuid,
  created_by uuid, created_at timestamptz not null default now()
);

-- ===== LEDGER: append-only =====
create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  type ledger_type not null,
  direction smallint not null check (direction in (1, -1)),
  amount bigint not null check (amount > 0),
  method pay_method,
  account ledger_account not null,
  member_id uuid references memberships(id),
  source_table text, source_id uuid,
  description text not null,
  cash_session_id uuid references cash_sessions(id),
  created_by uuid,
  reversal_of uuid references ledger_entries(id)
);
create index on ledger_entries(business_id, occurred_at);
create index on ledger_entries(cash_session_id);
create unique index ledger_one_reversal on ledger_entries(reversal_of) where reversal_of is not null;

create or replace function public.forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'Registro inmutable: % no permite % (use una reversa)', tg_table_name, tg_op
    using errcode = 'P0001';
end $$;
create trigger ledger_no_update before update or delete on ledger_entries
  for each row execute function forbid_mutation();
create trigger ledger_no_truncate before truncate on ledger_entries
  for each statement execute function forbid_mutation();

-- ===== comisiones =====
create table commission_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  member_id uuid references memberships(id) on delete cascade,
  item_type rule_item_type not null,
  item_id uuid,
  kind text not null check (kind in ('percent','fixed')),
  value numeric(12,3) not null check (value >= 0),
  base text not null default 'net_of_discount' check (base in ('gross','net_of_discount')),
  valid_from date, valid_to date
);

create table commission_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  member_id uuid not null references memberships(id),
  sale_id uuid not null references sales(id),
  sale_item_id uuid references sale_items(id),
  item_type rule_item_type not null,
  description text not null,
  rule_id uuid, -- sin FK: la regla puede borrarse; el snapshot es la verdad
  base_amount bigint not null,
  rule_snapshot jsonb not null,
  amount bigint not null, -- con signo; reversas en negativo
  occurred_at timestamptz not null default now(),
  reversal_of uuid references commission_entries(id),
  created_at timestamptz not null default now()
);
create index on commission_entries(member_id, occurred_at);
create unique index commission_one_reversal on commission_entries(reversal_of) where reversal_of is not null;
create trigger commission_no_mutation before update or delete on commission_entries
  for each row execute function forbid_mutation();

create table staff_advances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  member_id uuid not null references memberships(id),
  amount bigint not null check (amount > 0),
  method pay_method not null,
  note text,
  given_at timestamptz not null default now(),
  created_by uuid
);
create trigger advances_no_mutation before update or delete on staff_advances
  for each row execute function forbid_mutation();

create table payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  member_id uuid not null references memberships(id),
  period_start date not null, period_end date not null,
  commission_total bigint not null default 0,
  fixed_amount bigint not null default 0,
  fixed_note text,
  adjustments bigint not null default 0,
  advances bigint not null default 0,
  total bigint not null default 0,
  status payout_status not null default 'draft',
  approved_by uuid, approved_at timestamptz,
  paid_at timestamptz, paid_method pay_method, paid_by uuid,
  created_by uuid, created_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create unique index payouts_one_draft on payouts(member_id) where status = 'draft';

-- Detalle de la liquidación. commission/advance se enlazan una sola vez (no se pagan dos veces).
create table payout_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  payout_id uuid not null references payouts(id) on delete cascade,
  kind text not null check (kind in ('commission','adjustment','advance')),
  ref_id uuid,
  description text not null,
  amount bigint not null -- efecto sobre el total (anticipos en positivo; se restan al sumar)
);
create unique index payout_lines_ref_uniq on payout_lines(kind, ref_id) where kind in ('commission','advance');
create index on payout_lines(payout_id);

create table void_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  sale_id uuid not null references sales(id),
  requested_by uuid, reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid, decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index void_req_pending on void_requests(sale_id) where status = 'pending';

-- ===== auditoría (append-only) =====
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid, actor_id uuid,
  action text not null, table_name text not null, row_id uuid,
  before jsonb, after jsonb,
  created_at timestamptz not null default now()
);
create trigger audit_no_mutation before update or delete on audit_log
  for each row execute function forbid_mutation();

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb; o jsonb;
begin
  r := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  o := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  insert into audit_log(business_id, actor_id, action, table_name, row_id, before, after)
  values (coalesce((coalesce(r, o)->>'business_id')::uuid, null), auth.uid(), tg_op, tg_table_name,
          (coalesce(r, o)->>'id')::uuid, o, r);
  return null;
end $$;
create trigger audit_sales after insert or update or delete on sales for each row execute function audit_trigger();
create trigger audit_expenses after insert or update or delete on expenses for each row execute function audit_trigger();
create trigger audit_payouts after insert or update or delete on payouts for each row execute function audit_trigger();
create trigger audit_rules after insert or update or delete on commission_rules for each row execute function audit_trigger();
create trigger audit_memberships after insert or update or delete on memberships for each row execute function audit_trigger();
create trigger audit_comp after insert or update or delete on member_compensation for each row execute function audit_trigger();
create trigger audit_appts after update or delete on appointments for each row execute function audit_trigger();
create trigger audit_cash after insert or update on cash_sessions for each row execute function audit_trigger();
