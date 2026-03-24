-- RLS: defesa em profundidade
-- 1) Staff/admin podem ler public.users (vendedor na OS, listas internas). Antes só admin tinha SELECT amplo.
-- 2) Revoga privilégios de anon em tabelas do portal (PostgREST continua sujeito ao RLS; anon não deve ter acesso direto).
-- 3) Garante RLS ativo nas tabelas listadas (se existirem).

drop policy if exists "users_select_admin" on public.users;
drop policy if exists "users_select_staff_or_admin" on public.users;

create policy "users_select_staff_or_admin"
on public.users
for select
to authenticated
using (public.is_staff_or_admin());

do $$
declare
  tbl text;
  tables text[] := array[
    'users',
    'customers',
    'service_orders',
    'company_settings',
    'payment_methods',
    'hub_connections',
    'device_models',
    'device_brands',
    'device_types',
    'products',
    'product_stock_movements',
    'resale_devices',
    'resale_device_costs',
    'customer_devices',
    'contas',
    'financial_transactions',
    'recurring_expenses',
    'integration_webhooks',
    'warranty_templates',
    'service_order_entry_photos',
    'service_order_assistance_comments',
    'service_order_internal_comments'
  ];
begin
  foreach tbl in array tables
  loop
    if exists (
      select 1
      from pg_catalog.pg_tables
      where schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter table public.%I enable row level security', tbl);
      execute format('revoke all on table public.%I from anon', tbl);
    end if;
  end loop;
end $$;
