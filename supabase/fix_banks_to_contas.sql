-- Script para corrigir estrutura: garantir contas e remover banks
-- Execute no SQL Editor do Supabase (ou psql)
-- ATENÇÃO: Faça backup antes se tiver dados importantes

begin;

-- 1. Se banks existe e contas NÃO existe: renomear banks -> contas
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'banks')
     and not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'contas') then
    alter table public.banks rename to contas;
    drop policy if exists "banks_admin_all" on public.contas;
    create policy "contas_admin_all"
      on public.contas for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- 2. Se contas não existe (nem banks foi renomeado): criar do zero
create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  saldo_inicial_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Garantir coluna saldo_inicial_cents se a tabela já existia
alter table public.contas add column if not exists saldo_inicial_cents integer not null default 0;

alter table public.contas enable row level security;

drop policy if exists "contas_admin_all" on public.contas;
create policy "contas_admin_all"
  on public.contas for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 3. payment_methods: renomear bank_id -> conta_id OU adicionar conta_id
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payment_methods' and column_name = 'bank_id') then
    alter table public.payment_methods rename column bank_id to conta_id;
    drop index if exists payment_methods_bank_id_idx;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payment_methods' and column_name = 'conta_id') then
    alter table public.payment_methods add column conta_id uuid references public.contas(id) on delete set null;
  end if;
  create index if not exists payment_methods_conta_id_idx on public.payment_methods(conta_id);
end $$;

-- 4. recurring_expenses: renomear bank_id -> conta_id
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'recurring_expenses') then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'recurring_expenses' and column_name = 'bank_id') then
      alter table public.recurring_expenses rename column bank_id to conta_id;
      drop index if exists recurring_expenses_bank_id_idx;
    end if;
    create index if not exists recurring_expenses_conta_id_idx on public.recurring_expenses(conta_id);
  end if;
end $$;

-- 5. financial_transactions: renomear bank_id -> conta_id
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'financial_transactions') then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'financial_transactions' and column_name = 'bank_id') then
      alter table public.financial_transactions rename column bank_id to conta_id;
      drop index if exists financial_transactions_bank_id_idx;
    end if;
    create index if not exists financial_transactions_conta_id_idx on public.financial_transactions(conta_id);
  end if;
end $$;

-- 6. Remover tabela banks se ainda existir (caso tenha ficado órfã)
drop table if exists public.banks cascade;

commit;
