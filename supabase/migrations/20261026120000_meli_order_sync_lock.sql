create table if not exists public.meli_order_sync_locks (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ml_order_id text not null,
  lock_token uuid not null,
  locked_until timestamptz not null,
  primary key (organization_id, ml_order_id)
);

revoke all on public.meli_order_sync_locks from public, anon, authenticated;
grant all on public.meli_order_sync_locks to service_role;

create or replace function public.try_acquire_meli_order_sync_lock(
  p_organization_id uuid,
  p_ml_order_id text,
  p_lock_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer := 0;
begin
  insert into public.meli_order_sync_locks (
    organization_id, ml_order_id, lock_token, locked_until
  ) values (
    p_organization_id, p_ml_order_id, p_lock_token, now() + interval '15 minutes'
  )
  on conflict (organization_id, ml_order_id) do update
    set lock_token = excluded.lock_token,
        locked_until = excluded.locked_until
    where public.meli_order_sync_locks.locked_until < now();

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

create or replace function public.release_meli_order_sync_lock(
  p_organization_id uuid,
  p_ml_order_id text,
  p_lock_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer := 0;
begin
  delete from public.meli_order_sync_locks
  where organization_id = p_organization_id
    and ml_order_id = p_ml_order_id
    and lock_token = p_lock_token;
  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

revoke all on function public.try_acquire_meli_order_sync_lock(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.release_meli_order_sync_lock(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.try_acquire_meli_order_sync_lock(uuid, text, uuid) to service_role;
grant execute on function public.release_meli_order_sync_lock(uuid, text, uuid) to service_role;
