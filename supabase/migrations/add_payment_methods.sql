-- Tabela de formas de pagamento (dados da empresa)
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
