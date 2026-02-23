-- Tabela de aparelhos vinculados ao cliente (um cliente pode ter vários)
create table if not exists public.customer_devices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  device_model_id uuid null references public.device_models(id) on delete set null,
  brand text,
  model text,
  device_type text,
  imei text,
  color text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_devices_customer_id_idx
  on public.customer_devices(customer_id);

create index if not exists customer_devices_device_model_id_idx
  on public.customer_devices(device_model_id);

alter table public.customer_devices enable row level security;

drop policy if exists customer_devices_staff_admin_all on public.customer_devices;
create policy "customer_devices_staff_admin_all"
on public.customer_devices
for all
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

-- Trigger updated_at
create or replace function public.customer_devices_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customer_devices_set_updated_at on public.customer_devices;
create trigger customer_devices_set_updated_at
before update on public.customer_devices
for each row execute function public.customer_devices_set_updated_at();
