-- Pendências do relay /pix → grupo gerador → resposta ao solicitante

create table if not exists public.whatsapp_pix_relay_pending (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  hub_connection_id uuid not null references public.hub_connections (id) on delete cascade,
  instance_name text not null,
  requester_wa_from text not null,
  amount_display text not null,
  gerar_command text not null,
  pix_group_jid text not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists whatsapp_pix_relay_pending_lookup_idx
  on public.whatsapp_pix_relay_pending (organization_id, instance_name, pix_group_jid, status, created_at);

comment on table public.whatsapp_pix_relay_pending is
  'Relay /pix: aguarda resposta do grupo gerador antes de enviar a chave ao solicitante.';

alter table public.whatsapp_pix_relay_pending enable row level security;
