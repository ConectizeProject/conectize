-- Garante que staff e admin possam ler/escrever em products e product_stock_movements.
-- Se RLS estiver ativo sem policy, a listagem de produtos não via movimentos (estoque vazio).
-- Requer: função public.is_staff_or_admin()

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'products') then
    alter table public.products enable row level security;
    drop policy if exists "products_staff_admin_all" on public.products;
    create policy "products_staff_admin_all"
      on public.products for all to authenticated
      using (public.is_staff_or_admin())
      with check (public.is_staff_or_admin());
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'product_stock_movements') then
    alter table public.product_stock_movements enable row level security;
    drop policy if exists "product_stock_movements_staff_admin_all" on public.product_stock_movements;
    create policy "product_stock_movements_staff_admin_all"
      on public.product_stock_movements for all to authenticated
      using (public.is_staff_or_admin())
      with check (public.is_staff_or_admin());
  end if;
end $$;
