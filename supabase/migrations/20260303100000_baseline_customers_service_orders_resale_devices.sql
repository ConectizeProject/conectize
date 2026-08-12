-- Baseline para CLI local: fix_customers_table.sql, schema (service_orders) e add_resale_devices.sql
-- não tinham prefixo <timestamp>_ e eram ignorados; 20260305000003 referencia service_orders e resale_devices.

-- ========== customers (equivalente a fix_customers_table.sql) ==========
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.customers
  add column if not exists auth_user_id uuid,
  add column if not exists cpf text,
  add column if not exists cnpj text,
  add column if not exists is_company boolean,
  add column if not exists full_name text,
  add column if not exists company_name text,
  add column if not exists trade_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists mobile_phone text,
  add column if not exists contact_phone text,
  add column if not exists contact_notes text,
  add column if not exists address_full text,
  add column if not exists zip_code text,
  add column if not exists state text,
  add column if not exists city text,
  add column if not exists neighborhood text,
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists street_complement text,
  add column if not exists birth_date date,
  add column if not exists referral_source text,
  add column if not exists referral_source_other text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'cpf' and is_nullable = 'NO'
  ) then
    alter table public.customers alter column cpf drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'cnpj' and is_nullable = 'NO'
  ) then
    alter table public.customers alter column cnpj drop not null;
  end if;
end $$;

update public.customers set is_company = false where is_company is null;
alter table public.customers alter column is_company set default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_auth_user_id_fkey') then
    alter table public.customers
      add constraint customers_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

create unique index if not exists customers_auth_user_id_unique
  on public.customers(auth_user_id) where auth_user_id is not null;
create unique index if not exists customers_cpf_unique on public.customers(cpf) where cpf is not null;
create unique index if not exists customers_cnpj_unique on public.customers(cnpj) where cnpj is not null;
create index if not exists customers_zip_code_idx on public.customers(zip_code);
create index if not exists customers_cpf_idx on public.customers(cpf);
create index if not exists customers_cnpj_idx on public.customers(cnpj);

alter table public.customers enable row level security;

drop policy if exists customers_select_own on public.customers;
create policy customers_select_own
  on public.customers for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists customers_staff_admin_all on public.customers;
create policy customers_staff_admin_all
  on public.customers for all to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- ========== service_orders (trecho principal de schema.sql) ==========
create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  status text not null default 'orcamento' check (status in (
    'orcamento',
    'aguardando_aprovacao',
    'aprovado',
    'aguardando_pecas',
    'em_manutencao',
    'aguardando_retirada',
    'finalizada',
    'finalizada_sem_conserto',
    'finalizada_sem_aprovacao',
    'cancelada'
  )),
  title text not null,
  description text,
  device text,
  brand text,
  model text,
  created_by uuid null references auth.users(id) on delete set null,
  seller_user_id uuid null references auth.users(id) on delete set null,
  device_model_id uuid null references public.device_models(id) on delete set null,
  imei text,
  is_warranty boolean not null default false,
  estimated_ready_at timestamptz,
  passcode_type text,
  passcode_text text,
  passcode_pattern text,
  customer_description text,
  receiving_notes text,
  services jsonb not null default '[]'::jsonb,
  services_total_cents integer not null default 0,
  services_cost_total_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_orders
  add column if not exists device_location text,
  add column if not exists payment_method_id uuid,
  add column if not exists installments integer;

update public.service_orders set services = '[]'::jsonb where services is null;
alter table public.service_orders alter column services set default '[]'::jsonb;
update public.service_orders set services_total_cents = 0 where services_total_cents is null;
alter table public.service_orders alter column services_total_cents set default 0;
update public.service_orders set services_cost_total_cents = 0 where services_cost_total_cents is null;
alter table public.service_orders alter column services_cost_total_cents set default 0;
update public.service_orders set is_warranty = false where is_warranty is null;
alter table public.service_orders alter column is_warranty set default false;

alter table public.service_orders drop constraint if exists service_orders_passcode_type_check;
alter table public.service_orders
  add constraint service_orders_passcode_type_check check (
    passcode_type is null or passcode_type in ('text', 'pattern')
  );

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_orders_seller_user_id_fkey') then
    alter table public.service_orders
      add constraint service_orders_seller_user_id_fkey
      foreign key (seller_user_id) references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'service_orders_device_model_id_fkey') then
    alter table public.service_orders
      add constraint service_orders_device_model_id_fkey
      foreign key (device_model_id) references public.device_models(id) on delete set null;
  end if;
end $$;

create index if not exists service_orders_customer_id_idx on public.service_orders(customer_id);
create index if not exists service_orders_created_at_idx on public.service_orders(created_at desc);
create index if not exists service_orders_status_idx on public.service_orders(status);

create or replace function public.set_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists service_orders_set_updated_at on public.service_orders;
create trigger service_orders_set_updated_at
  before update on public.service_orders
  for each row execute function public.set_updated_at();

alter table public.service_orders enable row level security;

drop policy if exists service_orders_customer_select_own on public.service_orders;
create policy service_orders_customer_select_own
  on public.service_orders for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = service_orders.customer_id and c.auth_user_id = auth.uid()
    )
  );

drop policy if exists service_orders_staff_admin_all on public.service_orders;
create policy service_orders_staff_admin_all
  on public.service_orders for all to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- ========== resale_devices (equivalente a add_resale_devices.sql) ==========
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
create policy resale_devices_staff_admin_all
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
create policy resale_device_costs_staff_admin_all
  on public.resale_device_costs for all to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

grant select, insert, update, delete on public.customers to postgres, service_role, authenticated;
grant select, insert, update, delete on public.service_orders to postgres, service_role, authenticated;
grant select, insert, update, delete on public.resale_devices to postgres, service_role, authenticated;
grant select, insert, update, delete on public.resale_device_costs to postgres, service_role, authenticated;
