-- Chaves do MCP HTTP. O segredo em claro só volta na criação; aqui fica o SHA-256.

create table if not exists public.mcp_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  token_hash text not null check (char_length(token_hash) = 64),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists mcp_api_keys_token_hash_uidx
  on public.mcp_api_keys (token_hash);

create index if not exists mcp_api_keys_org_user_idx
  on public.mcp_api_keys (organization_id, user_id, created_at desc);

alter table public.mcp_api_keys enable row level security;

revoke all on public.mcp_api_keys from public, anon;
grant select, insert, update on public.mcp_api_keys to authenticated;

drop policy if exists mcp_api_keys_select on public.mcp_api_keys;
create policy mcp_api_keys_select
  on public.mcp_api_keys for select
  to authenticated
  using (
    public.is_staff_or_admin()
    and mcp_api_keys.organization_id = public.current_organization_id()
    and (
      mcp_api_keys.user_id = auth.uid()
      or public.is_admin()
    )
  );

drop policy if exists mcp_api_keys_insert on public.mcp_api_keys;
create policy mcp_api_keys_insert
  on public.mcp_api_keys for insert
  to authenticated
  with check (
    public.is_staff_or_admin()
    and mcp_api_keys.organization_id = public.current_organization_id()
    and mcp_api_keys.user_id = auth.uid()
    and mcp_api_keys.revoked_at is null
  );

drop policy if exists mcp_api_keys_update on public.mcp_api_keys;
create policy mcp_api_keys_update
  on public.mcp_api_keys for update
  to authenticated
  using (
    public.is_staff_or_admin()
    and mcp_api_keys.organization_id = public.current_organization_id()
    and (
      mcp_api_keys.user_id = auth.uid()
      or public.is_admin()
    )
  )
  with check (
    public.is_staff_or_admin()
    and mcp_api_keys.organization_id = public.current_organization_id()
    and (
      mcp_api_keys.user_id = auth.uid()
      or public.is_admin()
    )
  );

create or replace function public.mcp_api_keys_guard_update ()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.user_id is distinct from old.user_id
    or new.token_hash is distinct from old.token_hash
    or new.label is distinct from old.label
    or new.created_at is distinct from old.created_at
  then
    raise exception 'mcp_api_key_immutable';
  end if;

  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'mcp_api_key_already_revoked';
  end if;

  return new;
end;
$$;

drop trigger if exists mcp_api_keys_guard_update on public.mcp_api_keys;
create trigger mcp_api_keys_guard_update
  before update on public.mcp_api_keys
  for each row
  execute function public.mcp_api_keys_guard_update ();
