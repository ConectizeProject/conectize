-- WhatsApp Cloud API: conversas e mensagens (portal staff)

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  wa_from text not null,
  customer_id uuid references public.customers (id) on delete set null,
  last_message_at timestamptz not null default now(),
  needs_staff_attention boolean not null default false,
  automation_override boolean,
  state jsonb not null default '{}'::jsonb,
  draft_os jsonb,
  service_order_id uuid references public.service_orders (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_conversations_wa_from_key unique (wa_from)
);

create index if not exists whatsapp_conversations_last_msg_idx
  on public.whatsapp_conversations (last_message_at desc);

create index if not exists whatsapp_conversations_needs_attention_idx
  on public.whatsapp_conversations (needs_staff_attention)
  where needs_staff_attention = true;

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  wa_message_id text,
  body text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'attended')),
  resolved_by text check (resolved_by is null or resolved_by in ('ai', 'human')),
  needs_human boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_conversation_created_idx
  on public.whatsapp_messages (conversation_id, created_at);

create index if not exists whatsapp_messages_status_idx
  on public.whatsapp_messages (conversation_id, status);

create unique index if not exists whatsapp_messages_wa_id_unique
  on public.whatsapp_messages (wa_message_id)
  where wa_message_id is not null;

create or replace function public.set_whatsapp_conversations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists whatsapp_conversations_updated_at on public.whatsapp_conversations;
create trigger whatsapp_conversations_updated_at
  before update on public.whatsapp_conversations
  for each row execute function public.set_whatsapp_conversations_updated_at();

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;

create policy "whatsapp_conversations_staff_all"
on public.whatsapp_conversations
for all
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

create policy "whatsapp_messages_staff_all"
on public.whatsapp_messages
for all
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

comment on table public.whatsapp_conversations is 'Threads WhatsApp (um número wa_from por linha).';
comment on table public.whatsapp_messages is 'Mensagens inbound/outbound; IA outbound fica pending + needs_human até revisão humana.';
