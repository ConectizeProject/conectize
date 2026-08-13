-- Histórico de edições de aparelhos de revenda (venda e demais campos)

create table if not exists public.resale_device_edit_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  resale_device_id uuid not null references public.resale_devices (id) on delete cascade,
  edited_by uuid not null references public.users (id) on delete set null,
  edited_at timestamptz not null default now(),
  field_key text not null,
  old_value text,
  new_value text
);

create index if not exists resale_device_edit_history_device_edited_at_idx
  on public.resale_device_edit_history (resale_device_id, edited_at desc);

create index if not exists resale_device_edit_history_org_edited_at_idx
  on public.resale_device_edit_history (organization_id, edited_at desc);

alter table public.resale_device_edit_history enable row level security;

drop policy if exists resale_device_edit_history_select on public.resale_device_edit_history;
create policy resale_device_edit_history_select
  on public.resale_device_edit_history for select
  to authenticated
  using (
    public.is_staff_or_admin()
    and resale_device_edit_history.organization_id = public.current_organization_id()
  );

drop policy if exists resale_device_edit_history_insert on public.resale_device_edit_history;
create policy resale_device_edit_history_insert
  on public.resale_device_edit_history for insert
  to authenticated
  with check (
    public.is_staff_or_admin()
    and resale_device_edit_history.organization_id = public.current_organization_id()
    and resale_device_edit_history.edited_by = auth.uid()
  );

drop policy if exists resale_device_edit_history_delete on public.resale_device_edit_history;
create policy resale_device_edit_history_delete
  on public.resale_device_edit_history for delete
  to authenticated
  using (
    public.is_admin()
    and resale_device_edit_history.organization_id = public.current_organization_id()
  );

revoke all on public.resale_device_edit_history from anon;
grant select, insert, delete on public.resale_device_edit_history to authenticated;
