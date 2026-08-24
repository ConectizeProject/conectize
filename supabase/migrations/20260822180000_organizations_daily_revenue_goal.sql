-- Meta diária de faturamento (vendas + OS) para o dashboard do portal.
alter table public.organizations
  add column if not exists daily_revenue_goal_cents integer not null default 0;

comment on column public.organizations.daily_revenue_goal_cents is
  'Meta diária de faturamento em centavos (soma vendas + OS do dia).';
