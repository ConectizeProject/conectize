-- Setup completo do módulo Financeiro
-- Execute este script PRIMEIRO no SQL Editor do Supabase, antes do import_historico_financeiro.sql
-- Exige: função public.is_admin() e tabela payment_methods (já existem no projeto)

begin;

-- Se banks existe e contas não: renomear banks -> contas
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'banks')
     and not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'contas') then
    alter table public.banks rename to contas;
  end if;
end $$;

-- Contas (cria só se não existir)
create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  saldo_inicial_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contas enable row level security;

drop policy if exists "contas_admin_all" on public.contas;
create policy "contas_admin_all"
  on public.contas for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Forma de pagamento -> conta
alter table public.payment_methods
  add column if not exists conta_id uuid references public.contas(id) on delete set null;

create index if not exists payment_methods_conta_id_idx on public.payment_methods(conta_id);

-- Gastos recorrentes
create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  conta_id uuid not null references public.contas(id) on delete restrict,
  billing_day int not null check (billing_day >= 1 and billing_day <= 31),
  is_active boolean not null default true,
  last_generated_for text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_expenses_conta_id_idx on public.recurring_expenses(conta_id);

alter table public.recurring_expenses enable row level security;

drop policy if exists "recurring_expenses_admin_all" on public.recurring_expenses;
create policy "recurring_expenses_admin_all"
  on public.recurring_expenses for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Transações financeiras
create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete restrict,
  amount_cents integer not null,
  type text not null check (type in ('entrada', 'saida', 'transferencia', 'ajuste')),
  description text,
  occurred_at date not null default (current_date),
  created_at timestamptz not null default now(),
  recurring_expense_id uuid references public.recurring_expenses(id) on delete set null,
  transfer_id uuid null
);

create index if not exists financial_transactions_conta_id_idx on public.financial_transactions(conta_id);
create index if not exists financial_transactions_occurred_at_idx on public.financial_transactions(occurred_at desc);
create index if not exists financial_transactions_transfer_id_idx on public.financial_transactions(transfer_id);

alter table public.financial_transactions enable row level security;

drop policy if exists "financial_transactions_admin_all" on public.financial_transactions;
create policy "financial_transactions_admin_all"
  on public.financial_transactions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Saldo inicial em contas
alter table public.contas add column if not exists saldo_inicial_cents integer not null default 0;

-- Referências OS/seminovos (para import de histórico)
alter table public.financial_transactions
  add column if not exists service_order_id uuid references public.service_orders(id) on delete set null;

alter table public.financial_transactions
  add column if not exists resale_device_id uuid references public.resale_devices(id) on delete set null;

create index if not exists financial_transactions_service_order_id_idx
  on public.financial_transactions(service_order_id)
  where service_order_id is not null;

create index if not exists financial_transactions_resale_device_id_idx
  on public.financial_transactions(resale_device_id)
  where resale_device_id is not null;

commit;
