-- Renomeia banks -> contas e bank_id -> conta_id (para instalações que já rodaram a migration anterior)
-- Se a tabela banks não existir (instalação nova com migration editada), este script não faz nada útil.

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'banks') then
    alter table public.banks rename to contas;
    drop policy if exists "banks_admin_all" on public.contas;
    create policy "contas_admin_all"
      on public.contas for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payment_methods' and column_name = 'bank_id') then
      alter table public.payment_methods rename column bank_id to conta_id;
      drop index if exists payment_methods_bank_id_idx;
      create index if not exists payment_methods_conta_id_idx on public.payment_methods(conta_id);
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'recurring_expenses' and column_name = 'bank_id') then
      alter table public.recurring_expenses rename column bank_id to conta_id;
      drop index if exists recurring_expenses_bank_id_idx;
      create index if not exists recurring_expenses_conta_id_idx on public.recurring_expenses(conta_id);
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'financial_transactions' and column_name = 'bank_id') then
      alter table public.financial_transactions rename column bank_id to conta_id;
      drop index if exists financial_transactions_bank_id_idx;
      create index if not exists financial_transactions_conta_id_idx on public.financial_transactions(conta_id);
    end if;
  end if;
end $$;
