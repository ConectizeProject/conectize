-- Verifica se a migration de troca na venda está aplicada
select
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'resale_device_trade_ins'
  ) as table_exists,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'resale_device_trade_ins'
      and policyname = 'resale_device_trade_ins_staff_admin_all'
  ) as rls_policy_exists;
