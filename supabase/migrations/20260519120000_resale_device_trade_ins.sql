-- Aparelhos recebidos em troca ao registrar venda de um seminovo
create table if not exists public.resale_device_trade_ins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sale_device_id uuid not null references public.resale_devices (id) on delete cascade,
  received_device_id uuid references public.resale_devices (id) on delete set null,
  device_name text,
  imei text,
  info text,
  condition text,
  value_cents integer not null check (value_cents > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists resale_device_trade_ins_sale_device_id_idx
  on public.resale_device_trade_ins (sale_device_id);

create index if not exists resale_device_trade_ins_received_device_id_idx
  on public.resale_device_trade_ins (received_device_id);

create index if not exists resale_device_trade_ins_organization_id_idx
  on public.resale_device_trade_ins (organization_id);

alter table public.resale_device_trade_ins enable row level security;

drop policy if exists resale_device_trade_ins_staff_admin_all on public.resale_device_trade_ins;
create policy resale_device_trade_ins_staff_admin_all
  on public.resale_device_trade_ins for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and resale_device_trade_ins.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and resale_device_trade_ins.organization_id = public.current_organization_id()
  );

drop policy if exists resale_device_trade_ins_retailer_select on public.resale_device_trade_ins;
create policy resale_device_trade_ins_retailer_select
  on public.resale_device_trade_ins for select
  to authenticated
  using (
    public.is_retailer()
    and exists (
      select 1
      from public.resale_devices d
      join public.customer_portal_members m on m.user_id = auth.uid()
      join public.customers c on c.id = m.customer_id
      where d.id = resale_device_trade_ins.sale_device_id
        and c.organization_id = d.organization_id
    )
  );

grant select, insert, update, delete on public.resale_device_trade_ins to postgres, service_role, authenticated;
