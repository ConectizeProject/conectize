-- Conectize Portal (Supabase)
-- Execute este arquivo no SQL Editor do Supabase (projeto htryywfkqokuvelqtirf).

create extension if not exists "pgcrypto";

-- =========================
-- Helpers (roles)
-- =========================

create or replace function public.is_admin ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  );
$$;

create or replace function public.is_staff_or_admin ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('staff', 'admin')
  );
$$;

-- =========================
-- Users (1:1 com auth.users) - fonte de truth para role
-- =========================

alter table public.users
  add column if not exists email text,
  add column if not exists role text,
  add column if not exists full_name text,
  add column if not exists cpf text,
  add column if not exists phone text;

update public.users set role = 'user' where role is null or role = '';

alter table public.users
  alter column role set default 'user';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'role'
  ) then
    begin
      alter table public.users alter column role set not null;
    exception when others then
      -- se houver linhas com null, o update acima já deve corrigir
      null;
    end;
  end if;
end $$;

alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check check (role in ('user', 'staff', 'admin'));

-- CPF deve pertencer a 1 conta (quando preenchido)
create unique index if not exists users_cpf_unique
  on public.users(cpf)
  where cpf is not null;

create index if not exists users_cpf_idx
  on public.users(cpf);

-- Backfill de e-mail a partir do auth.users
update public.users u
set email = au.email
from auth.users au
where au.id = u.id
  and (u.email is null or u.email = '');

-- Garante que todo auth.users tenha um public.users
insert into public.users (id, email, role, created_at, updated_at)
select au.id, au.email, 'user', timezone('utc', now()), timezone('utc', now())
from auth.users au
left join public.users u on u.id = au.id
where u.id is null;

alter table public.users enable row level security;

drop policy if exists users_select_own on public.users;
create policy "users_select_own"
on public.users
for select
to authenticated
using (id = auth.uid());

drop policy if exists users_select_admin on public.users;
create policy "users_select_admin"
on public.users
for select
to authenticated
using (public.is_admin());

drop policy if exists users_update_own on public.users;
create policy "users_update_own"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists users_update_admin on public.users;
create policy "users_update_admin"
on public.users
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Impede elevação de privilégio via update próprio
create or replace function public.prevent_non_admin_role_change ()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    if not public.is_admin() then
      raise exception 'permission_denied';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists users_prevent_role_change on public.users;
create trigger users_prevent_role_change
before update on public.users
for each row execute function public.prevent_non_admin_role_change();

-- =========================
-- Trigger: garante public.users quando auth.users cria
-- =========================

create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id)
  do update set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================
-- Customers (clientes)
-- =========================

-- A tabela customers já existe (template do Supabase). Este bloco apenas estende
-- a tabela com os campos necessários para o portal (CPF + vínculo com auth.users).

alter table public.customers
  add column if not exists auth_user_id uuid,
  add column if not exists cpf text,
  add column if not exists cnpj text,
  add column if not exists is_company boolean,
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
  add column if not exists trade_name text,
  add column if not exists referral_source text,
  add column if not exists referral_source_other text;

create index if not exists customers_zip_code_idx
  on public.customers(zip_code);

update public.customers
set is_company = false
where is_company is null;

alter table public.customers
  alter column is_company set default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_auth_user_id_fkey'
  ) then
    alter table public.customers
      add constraint customers_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

create unique index if not exists customers_auth_user_id_unique
  on public.customers(auth_user_id)
  where auth_user_id is not null;

create unique index if not exists customers_cpf_unique
  on public.customers(cpf)
  where cpf is not null;

create unique index if not exists customers_cnpj_unique
  on public.customers(cnpj)
  where cnpj is not null;

create index if not exists customers_cpf_idx
  on public.customers(cpf);

create index if not exists customers_cnpj_idx
  on public.customers(cnpj);

alter table public.customers enable row level security;

drop policy if exists customers_select_own on public.customers;
create policy "customers_select_own"
on public.customers
for select
to authenticated
using (auth_user_id = auth.uid());

drop policy if exists customers_staff_admin_all on public.customers;
create policy "customers_staff_admin_all"
on public.customers
for all
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

-- RPC: cliente faz claim do cadastro via CPF (magic link + CPF)
create or replace function public.claim_customer_by_cpf (
  cpf_input text,
  name_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  existing_auth uuid;
  u_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select email into u_email from auth.users where id = auth.uid();

  -- CPF pertence a 1 conta (users.cpf)
  if exists (
    select 1
    from public.users u
    where u.cpf = cpf_input
      and u.id <> auth.uid()
  ) then
    raise exception 'cpf_already_claimed';
  end if;

  -- Se já existe CPF na conta, não permite trocar por outro
  if exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.cpf is not null
      and u.cpf <> cpf_input
  ) then
    raise exception 'cpf_mismatch';
  end if;

  -- Garante users (e grava cpf/nome)
  insert into public.users (id, email, cpf, full_name)
  values (auth.uid(), u_email, cpf_input, name_input)
  on conflict (id)
  do update set
    email = coalesce(excluded.email, public.users.email),
    cpf = coalesce(public.users.cpf, excluded.cpf),
    full_name = coalesce(excluded.full_name, public.users.full_name);

  select id, auth_user_id
    into existing_id, existing_auth
  from public.customers
  where cpf = cpf_input;

  if existing_id is null then
    insert into public.customers (cpf, full_name, email, auth_user_id)
    values (cpf_input, name_input, u_email, auth.uid())
    returning id into existing_id;

    return existing_id;
  end if;

  if existing_auth is null then
    update public.customers
      set auth_user_id = auth.uid(),
          full_name = coalesce(name_input, full_name),
          email = coalesce(u_email, email)
    where id = existing_id;

    return existing_id;
  end if;

  if existing_auth = auth.uid() then
    update public.customers
      set full_name = coalesce(name_input, full_name),
          email = coalesce(u_email, email)
    where id = existing_id;

    return existing_id;
  end if;

  raise exception 'cpf_already_claimed';
end;
$$;

revoke all on function public.claim_customer_by_cpf(text, text) from public;
grant execute on function public.claim_customer_by_cpf(text, text) to authenticated;

-- =========================
-- Device Models (catálogo)
-- =========================

create table if not exists public.device_models (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  device_type text not null,
  model text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists device_models_unique
  on public.device_models(brand, device_type, model);

create index if not exists device_models_brand_idx
  on public.device_models(brand);

create index if not exists device_models_device_type_idx
  on public.device_models(device_type);

create index if not exists device_models_model_idx
  on public.device_models(model);

alter table public.device_models enable row level security;

drop policy if exists device_models_staff_admin_all on public.device_models;
create policy "device_models_staff_admin_all"
on public.device_models
for all
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

-- =========================
-- Service Orders (OS)
-- =========================

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
  service text,
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
  internal_description text,
  receiving_notes text,
  services jsonb not null default '[]'::jsonb,
  services_total_cents integer not null default 0,
  services_cost_total_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Evolução segura (para bancos já criados)
alter table public.service_orders
  add column if not exists seller_user_id uuid,
  add column if not exists device_model_id uuid,
  add column if not exists imei text,
  add column if not exists is_warranty boolean,
  add column if not exists estimated_ready_at timestamptz,
  add column if not exists passcode_type text,
  add column if not exists passcode_text text,
  add column if not exists passcode_pattern text,
  add column if not exists customer_description text,
  add column if not exists internal_description text,
  add column if not exists receiving_notes text,
  add column if not exists assistance_info text,
  add column if not exists services jsonb,
  add column if not exists services_total_cents integer,
  add column if not exists services_cost_total_cents integer;

update public.service_orders
set services = '[]'::jsonb
where services is null;

alter table public.service_orders
  alter column services set default '[]'::jsonb;

update public.service_orders
set services_total_cents = 0
where services_total_cents is null;

alter table public.service_orders
  alter column services_total_cents set default 0;

update public.service_orders
set services_cost_total_cents = 0
where services_cost_total_cents is null;

alter table public.service_orders
  alter column services_cost_total_cents set default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_orders_services_total_cents_nonneg'
  ) then
    alter table public.service_orders
      add constraint service_orders_services_total_cents_nonneg
      check (services_total_cents >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_orders_services_cost_total_cents_nonneg'
  ) then
    alter table public.service_orders
      add constraint service_orders_services_cost_total_cents_nonneg
      check (services_cost_total_cents >= 0);
  end if;
end $$;

update public.service_orders
set is_warranty = false
where is_warranty is null;

alter table public.service_orders
  alter column is_warranty set default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_orders'
      and column_name = 'is_warranty'
  ) then
    begin
      alter table public.service_orders alter column is_warranty set not null;
    exception when others then
      null;
    end;
  end if;
end $$;

alter table public.service_orders
  drop constraint if exists service_orders_passcode_type_check;

alter table public.service_orders
  add constraint service_orders_passcode_type_check check (
    passcode_type is null or passcode_type in ('text', 'pattern')
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_orders_seller_user_id_fkey'
  ) then
    alter table public.service_orders
      add constraint service_orders_seller_user_id_fkey
      foreign key (seller_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_orders_device_model_id_fkey'
  ) then
    alter table public.service_orders
      add constraint service_orders_device_model_id_fkey
      foreign key (device_model_id) references public.device_models(id) on delete set null;
  end if;
end $$;

-- Migração de status legado (se existirem)
update public.service_orders set status = 'orcamento' where status = 'aberta';
update public.service_orders set status = 'em_manutencao' where status = 'em_andamento';

-- Default novo
alter table public.service_orders alter column status set default 'orcamento';

-- Substitui o check constraint antigo por um com nome conhecido
alter table public.service_orders drop constraint if exists service_orders_status_check;
alter table public.service_orders add constraint service_orders_status_check check (status in (
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
));

-- Backfill do vendedor
update public.service_orders
set seller_user_id = coalesce(seller_user_id, created_by)
where seller_user_id is null and created_by is not null;

create index if not exists service_orders_customer_id_idx on public.service_orders(customer_id);
create index if not exists service_orders_created_at_idx on public.service_orders(created_at desc);
create index if not exists service_orders_status_idx on public.service_orders(status);

-- Identificador único visível para usuários (OS #0, #1, #2...)
do $$
begin
  if not exists (select 1 from pg_sequences where schemaname = 'public' and sequencename = 'service_orders_display_number_seq') then
    create sequence public.service_orders_display_number_seq start 0;
  end if;
end $$;

alter table public.service_orders
  add column if not exists display_number integer;

update public.service_orders so
set display_number = sub.rn
from (
  select id, (row_number() over (order by created_at)) - 1 as rn
  from public.service_orders
) sub
where so.id = sub.id and so.display_number is null;

alter table public.service_orders
  alter column display_number set default nextval('public.service_orders_display_number_seq');

select setval(
  'public.service_orders_display_number_seq',
  (select coalesce(max(display_number), -1) + 1 from public.service_orders)
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'service_orders' and column_name = 'display_number'
      and is_nullable = 'YES'
  ) then
    alter table public.service_orders alter column display_number set not null;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_orders_display_number_key') then
    alter table public.service_orders add constraint service_orders_display_number_key unique (display_number);
  end if;
end $$;

-- Trigger: garante display_number no INSERT (autoincremento)
create or replace function public.set_service_order_display_number ()
returns trigger
language plpgsql
as $$
begin
  if new.display_number is null then
    new.display_number := nextval('public.service_orders_display_number_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists service_orders_set_display_number on public.service_orders;
create trigger service_orders_set_display_number
  before insert on public.service_orders
  for each row execute function public.set_service_order_display_number();

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

create policy "service_orders_customer_select_own"
on public.service_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = service_orders.customer_id
      and c.auth_user_id = auth.uid()
  )
);

create policy "service_orders_staff_admin_all"
on public.service_orders
for all
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

-- =========================
-- Company settings (dados da empresa)
-- =========================

create table if not exists public.company_settings (
  id int primary key default 1 check (id = 1),
  name text,
  cnpj text,
  address text,
  complement text,
  zip_code text,
  city text,
  state text,
  phone text,
  email text,
  logo_url text,
  updated_at timestamptz default now()
);

insert into public.company_settings (id, name, cnpj, address, zip_code, city, state, phone, email, logo_url)
values (1, 'Conectize', null, 'R. Padre Rolim, 620', '30130-094', 'Belo Horizonte', 'MG', '(31) 98614-0889', null, '/logo_conectize.svg')
on conflict (id) do nothing;

alter table public.company_settings enable row level security;

create policy "company_settings_staff_select"
on public.company_settings for select
to authenticated using (public.is_staff_or_admin());

create policy "company_settings_admin_all"
on public.company_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- Formas de pagamento
-- =========================

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  type text not null check (type in ('dinheiro', 'pix_direto', 'pix_maquina', 'credito', 'debito')),
  fee_percent numeric(5,2) default 0,
  credit_installment_fees jsonb default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_methods_type_idx on public.payment_methods(type);
create index if not exists payment_methods_sort_idx on public.payment_methods(sort_order);

alter table public.payment_methods enable row level security;

create policy "payment_methods_staff_select"
on public.payment_methods for select
to authenticated using (public.is_staff_or_admin());

create policy "payment_methods_admin_all"
on public.payment_methods for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- HUB (integrações)
-- =========================

create table if not exists public.hub_connections (
  id uuid primary key default gen_random_uuid(),
  platform_id text not null unique,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  api_key text,
  metadata jsonb default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists hub_connections_platform_id_idx on public.hub_connections(platform_id);

alter table public.hub_connections enable row level security;

create policy "hub_connections_staff_select"
on public.hub_connections for select
to authenticated using (public.is_staff_or_admin());

create policy "hub_connections_admin_all"
on public.hub_connections for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

