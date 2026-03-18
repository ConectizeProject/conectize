-- Habilita RLS e garante acesso apenas para usuários staff/admin
-- Tabelas: integration_webhooks, warranty_templates
-- Requer: função public.is_staff_or_admin()

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'integration_webhooks') then
    alter table public.integration_webhooks enable row level security;
    drop policy if exists "integration_webhooks_staff_admin_all" on public.integration_webhooks;
    create policy "integration_webhooks_staff_admin_all"
      on public.integration_webhooks for all to authenticated
      using (public.is_staff_or_admin())
      with check (public.is_staff_or_admin());
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'warranty_templates') then
    alter table public.warranty_templates enable row level security;
    drop policy if exists "warranty_templates_staff_admin_all" on public.warranty_templates;
    create policy "warranty_templates_staff_admin_all"
      on public.warranty_templates for all to authenticated
      using (public.is_staff_or_admin())
      with check (public.is_staff_or_admin());
  end if;
end $$;

