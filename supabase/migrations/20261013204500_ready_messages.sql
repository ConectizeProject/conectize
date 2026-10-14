-- Respostas prontas reutilizáveis (WhatsApp e Mercado Livre).

create table if not exists public.ready_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ready_messages_title_len check (char_length(btrim(title)) between 1 and 80),
  constraint ready_messages_body_len check (char_length(btrim(body)) between 1 and 4000)
);

create unique index if not exists ready_messages_org_title_uniq
  on public.ready_messages (organization_id, lower(title));

create index if not exists ready_messages_org_title_idx
  on public.ready_messages (organization_id, title);

alter table public.ready_messages enable row level security;

drop policy if exists ready_messages_staff_all on public.ready_messages;
create policy ready_messages_staff_all
  on public.ready_messages
  for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and organization_id = public.current_organization_id()
  );

grant select, insert, update, delete on public.ready_messages to postgres, service_role;
grant select, insert, update, delete on public.ready_messages to authenticated;
