-- Tabela para armazenar eventos de webhook recebidos (ex.: Bling)
create table if not exists public.integration_webhooks (
  id uuid default gen_random_uuid() primary key,
  platform_id text not null,
  event_type text not null,
  external_id text,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'processed', 'error')),
  error_message text,
  processed_at timestamptz,
  retry_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists integration_webhooks_platform_type_created_idx
  on public.integration_webhooks (platform_id, event_type, created_at desc);

create index if not exists integration_webhooks_status_idx
  on public.integration_webhooks (platform_id, status)
  where status in ('pending', 'error');

create index if not exists integration_webhooks_external_id_idx
  on public.integration_webhooks (external_id)
  where external_id is not null;
