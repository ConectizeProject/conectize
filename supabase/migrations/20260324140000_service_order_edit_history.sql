-- Histórico de edições por OS (campos alterados, valor antigo/novo, autor e data)

create table if not exists public.service_order_edit_history (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  edited_by uuid not null references public.users(id) on delete set null,
  edited_at timestamptz not null default now(),
  field_key text not null,
  old_value text,
  new_value text
);

create index if not exists service_order_edit_history_order_edited_at_idx
  on public.service_order_edit_history(service_order_id, edited_at desc);

alter table public.service_order_edit_history enable row level security;

drop policy if exists "service_order_edit_history_select_staff" on public.service_order_edit_history;
create policy "service_order_edit_history_select_staff"
on public.service_order_edit_history for select
to authenticated
using (public.is_staff_or_admin());

drop policy if exists "service_order_edit_history_insert_staff" on public.service_order_edit_history;
create policy "service_order_edit_history_insert_staff"
on public.service_order_edit_history for insert
to authenticated
with check (
  public.is_staff_or_admin()
  and edited_by = auth.uid()
  and exists (select 1 from public.service_orders so where so.id = service_order_id)
);

revoke all on public.service_order_edit_history from anon;
grant select, insert on public.service_order_edit_history to authenticated;

do $$
declare
  tbl text := 'service_order_edit_history';
begin
  if exists (
    select 1
    from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename = tbl
  ) then
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on table public.%I from anon', tbl);
  end if;
end $$;
