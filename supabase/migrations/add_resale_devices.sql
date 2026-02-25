-- Aparelhos seminovos para revenda
create table if not exists public.resale_devices (
  id uuid primary key default gen_random_uuid(),
  device_model_id uuid null references public.device_models(id) on delete set null,
  device_name text,
  model text,
  color text,
  storage_gb text,
  battery text,
  condition text,
  info text,
  imei text,
  imei2 text,
  serial text,
  purchase_value_cents integer,
  wholesale_value_cents integer,
  expected_profit_wholesale_cents integer,
  sale_value_cents integer,
  expected_profit_sale_cents integer,
  advertised boolean not null default false,
  tested boolean not null default false,
  label text,
  sold boolean not null default false,
  actual_profit_cents integer,
  purchase_date date,
  sale_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resale_devices_device_model_id_idx on public.resale_devices(device_model_id);
create index if not exists resale_devices_sold_idx on public.resale_devices(sold);
create index if not exists resale_devices_purchase_date_idx on public.resale_devices(purchase_date);

alter table public.resale_devices enable row level security;

drop policy if exists resale_devices_staff_admin_all on public.resale_devices;
create policy "resale_devices_staff_admin_all"
on public.resale_devices for all to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

create or replace function public.resale_devices_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists resale_devices_set_updated_at on public.resale_devices;
create trigger resale_devices_set_updated_at
before update on public.resale_devices
for each row execute function public.resale_devices_set_updated_at();

-- Custos de venda (lista por aparelho)
create table if not exists public.resale_device_costs (
  id uuid primary key default gen_random_uuid(),
  resale_device_id uuid not null references public.resale_devices(id) on delete cascade,
  description text,
  value_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists resale_device_costs_resale_device_id_idx on public.resale_device_costs(resale_device_id);

alter table public.resale_device_costs enable row level security;

drop policy if exists resale_device_costs_staff_admin_all on public.resale_device_costs;
create policy "resale_device_costs_staff_admin_all"
on public.resale_device_costs for all to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());
