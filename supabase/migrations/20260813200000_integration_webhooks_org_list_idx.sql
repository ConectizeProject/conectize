-- Acelera listagem admin de webhooks filtrada por org + plataforma + data.
create index if not exists integration_webhooks_org_platform_created_idx
  on public.integration_webhooks (organization_id, platform_id, created_at desc);

create index if not exists integration_webhooks_org_platform_status_created_idx
  on public.integration_webhooks (organization_id, platform_id, status, created_at desc);
