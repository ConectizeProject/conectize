-- Metas diárias separadas: vendas (PDV) e ordens de serviço.
alter table public.organizations
  add column if not exists daily_sales_revenue_goal_cents integer not null default 0,
  add column if not exists daily_os_revenue_goal_cents integer not null default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'daily_revenue_goal_cents'
  ) then
    update public.organizations
    set
      daily_sales_revenue_goal_cents = coalesce(daily_revenue_goal_cents, 0),
      daily_os_revenue_goal_cents = coalesce(daily_revenue_goal_cents, 0)
    where coalesce(daily_revenue_goal_cents, 0) > 0;

    alter table public.organizations
      drop column daily_revenue_goal_cents;
  end if;
end $$;

comment on column public.organizations.daily_sales_revenue_goal_cents is
  'Meta diária de faturamento em vendas (centavos).';

comment on column public.organizations.daily_os_revenue_goal_cents is
  'Meta diária de faturamento em ordens de serviço (centavos).';
