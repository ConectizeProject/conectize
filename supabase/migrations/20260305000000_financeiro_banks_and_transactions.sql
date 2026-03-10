-- Financeiro: contas, transações manuais/recorrentes/ajuste/transferência, vínculo forma de pagamento -> conta

-- Contas
create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  saldo_inicial_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contas enable row level security;

create policy "contas_admin_all"
  on public.contas for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Forma de pagamento -> conta (opcional)
alter table public.payment_methods
  add column if not exists conta_id uuid references public.contas(id) on delete set null;

create index if not exists payment_methods_conta_id_idx on public.payment_methods(conta_id);

-- Gastos recorrentes (dia da fatura; geração mensal de saída)
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

comment on column public.recurring_expenses.last_generated_for is 'Formato YYYY-MM para evitar duplicar geração no mesmo mês.';

create index if not exists recurring_expenses_conta_id_idx on public.recurring_expenses(conta_id);

alter table public.recurring_expenses enable row level security;

create policy "recurring_expenses_admin_all"
  on public.recurring_expenses for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Transações financeiras (entradas/saídas manuais, ajuste de saldo, transferências; OS não ficam aqui, vêm da tabela service_orders)
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

comment on column public.financial_transactions.amount_cents is 'Positivo = entrada, negativo = saída. Em transferência: negativo na origem, positivo no destino.';
comment on column public.financial_transactions.transfer_id is 'Par de transferência: duas linhas com mesmo transfer_id (uma negativa, uma positiva).';

create index if not exists financial_transactions_conta_id_idx on public.financial_transactions(conta_id);
create index if not exists financial_transactions_occurred_at_idx on public.financial_transactions(occurred_at desc);
create index if not exists financial_transactions_transfer_id_idx on public.financial_transactions(transfer_id);

alter table public.financial_transactions enable row level security;

create policy "financial_transactions_admin_all"
  on public.financial_transactions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
