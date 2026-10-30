-- 0003_messaging: plantillas y cola de mensajes (proveedor real = fuera de MVP; ver src/lib/messaging.ts)
create type message_status as enum ('pending','sending','sent','failed','cancelled');

create table message_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null check (kind in ('reminder','confirmation','custom','receipt')),
  channel text not null default 'whatsapp',
  body text not null,
  provider_template_id text
);

create table scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  appointment_id uuid references appointments(id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp','sms')),
  template_id uuid references message_templates(id),
  kind text not null default 'custom',
  to_phone text,
  payload jsonb not null default '{}', -- { body: "texto ya renderizado" }
  send_at timestamptz not null,
  status message_status not null default 'pending',
  attempts integer not null default 0,
  provider_msg_id text, error text,
  created_by uuid, created_at timestamptz not null default now()
);
create index on scheduled_messages(status, send_at);
create index on scheduled_messages(business_id, send_at);
create index on scheduled_messages(appointment_id);

-- Al cancelar o mover una cita se cancelan sus mensajes pendientes (recordatorios).
create or replace function public.appointments_msg_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('cancelled','no_show','completed') or new.starts_at <> old.starts_at then
    update scheduled_messages set status = 'cancelled'
      where appointment_id = new.id and status = 'pending' and kind = 'reminder';
  end if;
  if new.starts_at <> old.starts_at and new.status not in ('cancelled','no_show','completed') then
    perform public.schedule_reminders(new.id);
  end if;
  return null;
end $$;
