-- Migration para garantir que a tabela customers tenha todas as colunas necessárias
-- e constraints corretas para suportar CPF e CNPJ

-- Garante que a tabela customers exista (se não vier do template do Supabase)
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Garante todas as colunas usadas pela API /api/portal/customers
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

-- Garante que CPF e CNPJ podem ser NULL (removendo NOT NULL se existir)
do $$
begin
  -- Remove NOT NULL de cpf se existir
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'cpf'
      and is_nullable = 'NO'
  ) then
    alter table public.customers alter column cpf drop not null;
  end if;

  -- Remove NOT NULL de cnpj se existir
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'cnpj'
      and is_nullable = 'NO'
  ) then
    alter table public.customers alter column cnpj drop not null;
  end if;
end $$;

-- Garante valor padrão para is_company
update public.customers
set is_company = false
where is_company is null;

alter table public.customers
  alter column is_company set default false;

-- FK para auth_user_id
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_auth_user_id_fkey'
  ) then
    alter table public.customers
      add constraint customers_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

-- Índices únicos (com WHERE para permitir múltiplos NULLs)
create unique index if not exists customers_auth_user_id_unique
  on public.customers(auth_user_id)
  where auth_user_id is not null;

create unique index if not exists customers_cpf_unique
  on public.customers(cpf)
  where cpf is not null;

create unique index if not exists customers_cnpj_unique
  on public.customers(cnpj)
  where cnpj is not null;

-- Índices para busca
create index if not exists customers_zip_code_idx
  on public.customers(zip_code);

create index if not exists customers_cpf_idx
  on public.customers(cpf);

create index if not exists customers_cnpj_idx
  on public.customers(cnpj);

-- Garante que não há conflito: CPF e CNPJ não podem estar ambos preenchidos
-- (removendo constraint muito restritiva que pode causar problemas com dados existentes)
-- A validação será feita na aplicação
