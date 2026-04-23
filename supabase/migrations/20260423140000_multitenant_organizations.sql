-- Multi-tenant: organizations, members, portal context, organization_id on business tables,
-- display_number scoped per org, helper functions, RLS refresh.

-- ---------------------------------------------------------------------------
-- 1) Core tables
-- ---------------------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  is_host boolean not null default false,
  name text,
  cnpj text,
  address text,
  complement text,
  zip_code text,
  city text,
  state text,
  phone text,
  email text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_key unique (slug)
);

create unique index if not exists organizations_cnpj_unique
  on public.organizations (cnpj)
  where cnpj is not null;

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_in_org text not null
    constraint organization_members_role_check
      check (role_in_org in ('admin', 'staff', 'user')),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id);

create table if not exists public.user_portal_context (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active_organization_id uuid references public.organizations (id) on delete set null
);

create index if not exists user_portal_context_org_idx
  on public.user_portal_context (active_organization_id);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.user_portal_context enable row level security;

grant select, insert, update, delete on public.organizations to postgres, service_role;
grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to postgres, service_role;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.user_portal_context to postgres, service_role;
grant select, insert, update, delete on public.user_portal_context to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Host org (Conectize) from company_settings + fixed slug
-- ---------------------------------------------------------------------------

insert into public.organizations (id, slug, is_host, name, cnpj, address, complement, zip_code, city, state, phone, email, logo_url)
select
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  'conectize',
  true,
  cs.name,
  cs.cnpj,
  cs.address,
  cs.complement,
  cs.zip_code,
  cs.city,
  cs.state,
  cs.phone,
  cs.email,
  cs.logo_url
from public.company_settings cs
where cs.id = 1
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 3) users.role includes platform_admin
-- ---------------------------------------------------------------------------

alter table public.users drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check check (
    role in ('user', 'staff', 'admin', 'retailer', 'platform_admin')
  );

-- ---------------------------------------------------------------------------
-- 4) Add organization_id columns (nullable first)
-- ---------------------------------------------------------------------------

alter table public.customers add column if not exists organization_id uuid references public.organizations (id);

alter table public.service_orders add column if not exists organization_id uuid references public.organizations (id);

alter table public.products add column if not exists organization_id uuid references public.organizations (id);

alter table public.product_stock_movements add column if not exists organization_id uuid references public.organizations (id);

alter table public.payment_methods add column if not exists organization_id uuid references public.organizations (id);

alter table public.hub_connections add column if not exists organization_id uuid references public.organizations (id);

alter table public.resale_devices add column if not exists organization_id uuid references public.organizations (id);

alter table public.resale_device_costs add column if not exists organization_id uuid references public.organizations (id);

alter table public.customer_devices add column if not exists organization_id uuid references public.organizations (id);

alter table public.contas add column if not exists organization_id uuid references public.organizations (id);

alter table public.financial_transactions add column if not exists organization_id uuid references public.organizations (id);

alter table public.recurring_expenses add column if not exists organization_id uuid references public.organizations (id);

alter table public.integration_webhooks add column if not exists organization_id uuid references public.organizations (id);

alter table public.warranty_templates add column if not exists organization_id uuid references public.organizations (id);

alter table public.service_order_entry_photos add column if not exists organization_id uuid references public.organizations (id);

alter table public.service_order_assistance_comments add column if not exists organization_id uuid references public.organizations (id);

alter table public.service_order_internal_comments add column if not exists organization_id uuid references public.organizations (id);

alter table public.service_order_edit_history add column if not exists organization_id uuid references public.organizations (id);

alter table public.service_order_exit_photos add column if not exists organization_id uuid references public.organizations (id);

alter table public.whatsapp_conversations add column if not exists organization_id uuid references public.organizations (id);

alter table public.pricing_tags add column if not exists organization_id uuid references public.organizations (id);

-- ---------------------------------------------------------------------------
-- 5) Backfill (host org)
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
begin
  update public.customers set organization_id = v_host where organization_id is null;
  update public.service_orders so set organization_id = v_host
  from public.customers c
  where so.customer_id = c.id and so.organization_id is null and c.organization_id is not null;

  update public.products set organization_id = v_host where organization_id is null;

  update public.product_stock_movements m set organization_id = p.organization_id
  from public.products p
  where m.product_id = p.id and m.organization_id is null;

  update public.payment_methods set organization_id = v_host where organization_id is null;

  update public.hub_connections set organization_id = v_host where organization_id is null;

  update public.resale_devices set organization_id = v_host where organization_id is null;

  update public.resale_device_costs x set organization_id = d.organization_id
  from public.resale_devices d
  where x.resale_device_id = d.id and x.organization_id is null;

  update public.customer_devices cd set organization_id = c.organization_id
  from public.customers c
  where cd.customer_id = c.id and cd.organization_id is null;

  update public.contas set organization_id = v_host where organization_id is null;

  update public.financial_transactions t set organization_id = co.organization_id
  from public.contas co
  where t.conta_id = co.id and t.organization_id is null;

  update public.recurring_expenses e set organization_id = co.organization_id
  from public.contas co
  where e.conta_id = co.id and e.organization_id is null;

  update public.integration_webhooks set organization_id = v_host where organization_id is null;

  update public.warranty_templates set organization_id = v_host where organization_id is null;

  update public.service_order_entry_photos p set organization_id = so.organization_id
  from public.service_orders so
  where p.service_order_id = so.id and p.organization_id is null;

  update public.service_order_assistance_comments p set organization_id = so.organization_id
  from public.service_orders so
  where p.service_order_id = so.id and p.organization_id is null;

  update public.service_order_internal_comments p set organization_id = so.organization_id
  from public.service_orders so
  where p.service_order_id = so.id and p.organization_id is null;

  update public.service_order_edit_history p set organization_id = so.organization_id
  from public.service_orders so
  where p.service_order_id = so.id and p.organization_id is null;

  update public.service_order_exit_photos p set organization_id = so.organization_id
  from public.service_orders so
  where p.service_order_id = so.id and p.organization_id is null;

  update public.whatsapp_conversations w set organization_id = c.organization_id
  from public.customers c
  where w.customer_id = c.id and w.organization_id is null;

  update public.whatsapp_conversations w set organization_id = v_host
  where w.organization_id is null;

  update public.pricing_tags set organization_id = v_host where organization_id is null;
end $$;

-- product_compatible_device_models: add org via product
alter table public.product_compatible_device_models add column if not exists organization_id uuid references public.organizations (id);

update public.product_compatible_device_models pcm set organization_id = p.organization_id
from public.products p
where pcm.product_id = p.id and pcm.organization_id is null;

-- ---------------------------------------------------------------------------
-- 6) NOT NULL where required
-- ---------------------------------------------------------------------------

alter table public.customers alter column organization_id set not null;
alter table public.service_orders alter column organization_id set not null;
alter table public.products alter column organization_id set not null;
alter table public.product_stock_movements alter column organization_id set not null;
alter table public.payment_methods alter column organization_id set not null;
alter table public.hub_connections alter column organization_id set not null;
alter table public.resale_devices alter column organization_id set not null;
alter table public.resale_device_costs alter column organization_id set not null;
alter table public.customer_devices alter column organization_id set not null;
alter table public.contas alter column organization_id set not null;
alter table public.financial_transactions alter column organization_id set not null;
alter table public.recurring_expenses alter column organization_id set not null;
alter table public.integration_webhooks alter column organization_id set not null;
alter table public.warranty_templates alter column organization_id set not null;
alter table public.service_order_entry_photos alter column organization_id set not null;
alter table public.service_order_assistance_comments alter column organization_id set not null;
alter table public.service_order_internal_comments alter column organization_id set not null;
alter table public.service_order_edit_history alter column organization_id set not null;
alter table public.service_order_exit_photos alter column organization_id set not null;
alter table public.whatsapp_conversations alter column organization_id set not null;
alter table public.pricing_tags alter column organization_id set not null;
alter table public.product_compatible_device_models alter column organization_id set not null;

create index if not exists customers_organization_id_idx on public.customers (organization_id);
create index if not exists service_orders_organization_id_idx on public.service_orders (organization_id);
create index if not exists products_organization_id_idx on public.products (organization_id);
create index if not exists payment_methods_organization_id_idx on public.payment_methods (organization_id);
create index if not exists hub_connections_organization_id_idx on public.hub_connections (organization_id);
create index if not exists resale_devices_organization_id_idx on public.resale_devices (organization_id);
create index if not exists contas_organization_id_idx on public.contas (organization_id);
create index if not exists financial_transactions_organization_id_idx on public.financial_transactions (organization_id);
create index if not exists pricing_tags_organization_id_idx on public.pricing_tags (organization_id);
create index if not exists product_compatible_device_models_org_idx on public.product_compatible_device_models (organization_id);

-- ---------------------------------------------------------------------------
-- 7) display_number per organization
-- ---------------------------------------------------------------------------

alter table public.service_orders drop constraint if exists service_orders_display_number_key;

create unique index if not exists service_orders_org_display_number_key
  on public.service_orders (organization_id, display_number);

drop trigger if exists service_orders_set_display_number on public.service_orders;

create or replace function public.set_service_order_display_number ()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    raise exception 'organization_id is required for service_orders';
  end if;
  if new.display_number is null then
    perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 0));
    select coalesce(max(so.display_number), -1) + 1 into new.display_number
    from public.service_orders so
    where so.organization_id = new.organization_id;
  end if;
  return new;
end;
$$;

create trigger service_orders_set_display_number
  before insert on public.service_orders
  for each row execute function public.set_service_order_display_number();

-- Optional: keep global sequence unused; do not attach as default anymore
alter table public.service_orders alter column display_number drop default;

-- ---------------------------------------------------------------------------
-- 8) organization_members backfill + user_portal_context
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
begin
  insert into public.organization_members (organization_id, user_id, role_in_org)
  select v_host, u.id,
    case u.role
      when 'admin' then 'admin'::text
      when 'staff' then 'staff'::text
      else 'user'::text
    end
  from public.users u
  where u.role <> 'retailer'
  on conflict (organization_id, user_id) do nothing;

  insert into public.user_portal_context (user_id, active_organization_id)
  select u.id, v_host
  from public.users u
  where u.role <> 'retailer'
  on conflict (user_id) do update
    set active_organization_id = excluded.active_organization_id;
end $$;

-- Retailers: ensure membership on their customer's org (may differ after future multi-org customers)
insert into public.organization_members (organization_id, user_id, role_in_org)
select distinct c.organization_id, m.user_id, 'user'::text
from public.customer_portal_members m
join public.customers c on c.id = m.customer_id
join public.users u on u.id = m.user_id and u.role = 'retailer'
on conflict (organization_id, user_id) do nothing;

insert into public.user_portal_context (user_id, active_organization_id)
select m.user_id, c.organization_id
from public.customer_portal_members m
join public.customers c on c.id = m.customer_id
join public.users u on u.id = m.user_id and u.role = 'retailer'
on conflict (user_id) do update
  set active_organization_id = excluded.active_organization_id;

-- ---------------------------------------------------------------------------
-- 9) WhatsApp: unique per org + phone
-- ---------------------------------------------------------------------------

alter table public.whatsapp_conversations drop constraint if exists whatsapp_conversations_wa_from_key;

create unique index if not exists whatsapp_conversations_org_wa_from_key
  on public.whatsapp_conversations (organization_id, wa_from);

-- ---------------------------------------------------------------------------
-- 10) Helper functions (RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_platform_admin ()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'platform_admin'
  );
$$;

create or replace function public.current_organization_id ()
returns uuid
language sql
security definer
set search_path = public
as $$
  select c.active_organization_id
  from public.user_portal_context c
  where c.user_id = auth.uid();
$$;

create or replace function public.is_host_organization_context ()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations o
    where o.id = public.current_organization_id()
      and o.is_host = true
  );
$$;

create or replace function public.is_staff_or_admin ()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_organization_id() is not null
    and (
      public.is_platform_admin()
      or exists (
        select 1
        from public.organization_members m
        where m.user_id = auth.uid()
          and m.organization_id = public.current_organization_id()
          and m.role_in_org in ('admin', 'staff')
      )
    );
$$;

create or replace function public.is_admin ()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_organization_id() is not null
    and (
      public.is_platform_admin()
      or exists (
        select 1
        from public.organization_members m
        where m.user_id = auth.uid()
          and m.organization_id = public.current_organization_id()
          and m.role_in_org = 'admin'
      )
    );
$$;

revoke all on function public.is_platform_admin () from public;
grant execute on function public.is_platform_admin () to authenticated;

revoke all on function public.current_organization_id () from public;
grant execute on function public.current_organization_id () to authenticated;

revoke all on function public.is_host_organization_context () from public;
grant execute on function public.is_host_organization_context () to authenticated;

revoke all on function public.is_staff_or_admin () from public;
grant execute on function public.is_staff_or_admin () to authenticated;

revoke all on function public.is_admin () from public;
grant execute on function public.is_admin () to authenticated;

create or replace function public.customer_belongs_to_current_organization (p_customer_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.organization_id = public.current_organization_id()
  );
$$;

revoke all on function public.customer_belongs_to_current_organization (uuid) from public;
grant execute on function public.customer_belongs_to_current_organization (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11) Trigger: role changes (platform_admin or org admin)
-- ---------------------------------------------------------------------------

create or replace function public.prevent_non_admin_role_change ()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    -- Sem JWT de utilizador (SQL Editor, service role sem sub, migrações).
    if auth.uid() is not null
       and not (
      public.is_platform_admin()
      or public.is_admin()
    ) then
      raise exception 'permission_denied';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12) RLS — organizations & members & portal context
-- ---------------------------------------------------------------------------

drop policy if exists organizations_select_members on public.organizations;
create policy organizations_select_members
  on public.organizations for select
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1
      from public.organization_members m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists organizations_update_org_admin on public.organizations;
create policy organizations_update_org_admin
  on public.organizations for update
  to authenticated
  using (
    (
      public.is_platform_admin()
      and public.current_organization_id() = organizations.id
    )
    or (
      public.current_organization_id() = organizations.id
      and exists (
        select 1
        from public.organization_members m
        where m.user_id = auth.uid()
          and m.organization_id = organizations.id
          and m.role_in_org = 'admin'
      )
    )
  )
  with check (
    (
      public.is_platform_admin()
      and public.current_organization_id() = organizations.id
    )
    or (
      public.current_organization_id() = organizations.id
      and exists (
        select 1
        from public.organization_members m
        where m.user_id = auth.uid()
          and m.organization_id = organizations.id
          and m.role_in_org = 'admin'
      )
    )
  );

revoke insert on public.organizations from authenticated;

drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select
  on public.organization_members for select
  to authenticated
  using (
    public.is_platform_admin()
    or user_id = auth.uid()
    or (
      organization_members.organization_id = public.current_organization_id()
      and public.is_staff_or_admin()
    )
  );

drop policy if exists organization_members_mutate_staff on public.organization_members;
create policy organization_members_mutate_staff
  on public.organization_members for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and organization_members.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and organization_members.organization_id = public.current_organization_id()
  );

drop policy if exists user_portal_context_own on public.user_portal_context;
create policy user_portal_context_own
  on public.user_portal_context for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 13) RLS — users (scoped)
-- ---------------------------------------------------------------------------

drop policy if exists users_select_staff_or_admin on public.users;
create policy users_select_staff_or_admin
  on public.users for select
  to authenticated
  using (
    id = auth.uid()
    or (
      public.current_organization_id() is not null
      and public.is_staff_or_admin()
      and (
        public.is_platform_admin()
        or exists (
          select 1
          from public.organization_members m
          where m.user_id = users.id
            and m.organization_id = public.current_organization_id()
        )
      )
    )
  );

drop policy if exists users_update_admin on public.users;
create policy users_update_admin
  on public.users for update
  to authenticated
  using (
    public.is_platform_admin()
    or (
      public.is_admin()
      and exists (
        select 1
        from public.organization_members m
        where m.user_id = users.id
          and m.organization_id = public.current_organization_id()
      )
    )
  )
  with check (
    public.is_platform_admin()
    or (
      public.is_admin()
      and exists (
        select 1
        from public.organization_members m
        where m.user_id = users.id
          and m.organization_id = public.current_organization_id()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 14) RLS — customers & service_orders
-- ---------------------------------------------------------------------------

drop policy if exists customers_staff_admin_all on public.customers;
create policy customers_staff_admin_all
  on public.customers for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and customers.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and customers.organization_id = public.current_organization_id()
  );

drop policy if exists customers_select_own on public.customers;
create policy customers_select_own
  on public.customers for select
  to authenticated
  using (
    auth_user_id = auth.uid()
    or exists (
      select 1
      from public.customer_portal_members m
      where m.customer_id = customers.id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists service_orders_staff_admin_all on public.service_orders;
create policy service_orders_staff_admin_all
  on public.service_orders for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and service_orders.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and service_orders.organization_id = public.current_organization_id()
  );

drop policy if exists service_orders_customer_select_own on public.service_orders;
create policy service_orders_customer_select_own
  on public.service_orders for select
  to authenticated
  using (
    exists (
      select 1
      from public.customers c
      where c.id = service_orders.customer_id
        and c.organization_id = service_orders.organization_id
        and (
          c.auth_user_id = auth.uid()
          or exists (
            select 1
            from public.customer_portal_members m
            where m.customer_id = c.id
              and m.user_id = auth.uid()
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 15) RLS — company_settings (host legacy row; restrict to host context)
-- ---------------------------------------------------------------------------

drop policy if exists company_settings_staff_select on public.company_settings;
drop policy if exists company_settings_admin_all on public.company_settings;

create policy company_settings_staff_select
  on public.company_settings for select
  to authenticated
  using (
    public.is_staff_or_admin()
    and public.is_host_organization_context()
  );

create policy company_settings_admin_all
  on public.company_settings for all
  to authenticated
  using (
    public.is_admin()
    and public.is_host_organization_context()
  )
  with check (
    public.is_admin()
    and public.is_host_organization_context()
  );

-- ---------------------------------------------------------------------------
-- 16) RLS — payment_methods, hub, resale, customer_devices, finance
-- ---------------------------------------------------------------------------

drop policy if exists payment_methods_staff_select on public.payment_methods;
drop policy if exists payment_methods_admin_all on public.payment_methods;

create policy payment_methods_staff_select
  on public.payment_methods for select
  to authenticated
  using (
    public.is_staff_or_admin()
    and payment_methods.organization_id = public.current_organization_id()
  );

create policy payment_methods_admin_all
  on public.payment_methods for all
  to authenticated
  using (
    public.is_admin()
    and payment_methods.organization_id = public.current_organization_id()
  )
  with check (
    public.is_admin()
    and payment_methods.organization_id = public.current_organization_id()
  );

drop policy if exists payment_methods_retailer_select on public.payment_methods;
create policy payment_methods_retailer_select
  on public.payment_methods for select
  to authenticated
  using (
    public.is_retailer()
    and exists (
      select 1
      from public.customer_portal_members m
      join public.customers c on c.id = m.customer_id
      where m.user_id = auth.uid()
        and c.organization_id = payment_methods.organization_id
    )
  );

drop policy if exists hub_connections_staff_select on public.hub_connections;
drop policy if exists hub_connections_admin_all on public.hub_connections;

create policy hub_connections_staff_select
  on public.hub_connections for select
  to authenticated
  using (
    public.is_staff_or_admin()
    and hub_connections.organization_id = public.current_organization_id()
  );

create policy hub_connections_admin_all
  on public.hub_connections for all
  to authenticated
  using (
    public.is_admin()
    and hub_connections.organization_id = public.current_organization_id()
  )
  with check (
    public.is_admin()
    and hub_connections.organization_id = public.current_organization_id()
  );

drop policy if exists resale_devices_staff_admin_all on public.resale_devices;
create policy resale_devices_staff_admin_all
  on public.resale_devices for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and resale_devices.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and resale_devices.organization_id = public.current_organization_id()
  );

drop policy if exists resale_devices_retailer_select on public.resale_devices;
create policy resale_devices_retailer_select
  on public.resale_devices for select
  to authenticated
  using (
    public.is_retailer()
    and exists (
      select 1
      from public.customer_portal_members m
      join public.customers c on c.id = m.customer_id
      where m.user_id = auth.uid()
        and c.organization_id = resale_devices.organization_id
    )
  );

drop policy if exists resale_device_costs_staff_admin_all on public.resale_device_costs;
create policy resale_device_costs_staff_admin_all
  on public.resale_device_costs for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and resale_device_costs.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and resale_device_costs.organization_id = public.current_organization_id()
  );

drop policy if exists resale_device_costs_retailer_select on public.resale_device_costs;
create policy resale_device_costs_retailer_select
  on public.resale_device_costs for select
  to authenticated
  using (
    public.is_retailer()
    and exists (
      select 1
      from public.resale_devices d
      join public.customer_portal_members m on m.user_id = auth.uid()
      join public.customers c on c.id = m.customer_id
      where d.id = resale_device_costs.resale_device_id
        and c.organization_id = d.organization_id
    )
  );

drop policy if exists customer_devices_staff_admin_all on public.customer_devices;
create policy customer_devices_staff_admin_all
  on public.customer_devices for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and customer_devices.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and customer_devices.organization_id = public.current_organization_id()
  );

drop policy if exists contas_admin_all on public.contas;
create policy contas_admin_all
  on public.contas for all
  to authenticated
  using (
    public.is_admin()
    and contas.organization_id = public.current_organization_id()
  )
  with check (
    public.is_admin()
    and contas.organization_id = public.current_organization_id()
  );

drop policy if exists recurring_expenses_admin_all on public.recurring_expenses;
create policy recurring_expenses_admin_all
  on public.recurring_expenses for all
  to authenticated
  using (
    public.is_admin()
    and recurring_expenses.organization_id = public.current_organization_id()
  )
  with check (
    public.is_admin()
    and recurring_expenses.organization_id = public.current_organization_id()
  );

drop policy if exists financial_transactions_admin_all on public.financial_transactions;
create policy financial_transactions_admin_all
  on public.financial_transactions for all
  to authenticated
  using (
    public.is_admin()
    and financial_transactions.organization_id = public.current_organization_id()
  )
  with check (
    public.is_admin()
    and financial_transactions.organization_id = public.current_organization_id()
  );

-- ---------------------------------------------------------------------------
-- 17) RLS — products & stock & pricing (org-scoped)
-- ---------------------------------------------------------------------------

drop policy if exists products_staff_admin_all on public.products;
create policy products_staff_admin_all
  on public.products for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and products.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and products.organization_id = public.current_organization_id()
  );

drop policy if exists product_stock_movements_staff_admin_all on public.product_stock_movements;
create policy product_stock_movements_staff_admin_all
  on public.product_stock_movements for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and product_stock_movements.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and product_stock_movements.organization_id = public.current_organization_id()
  );

drop policy if exists pricing_tags_staff_admin_all on public.pricing_tags;
create policy pricing_tags_staff_admin_all
  on public.pricing_tags for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and pricing_tags.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and pricing_tags.organization_id = public.current_organization_id()
  );

drop policy if exists product_compatible_device_models_staff_admin_all on public.product_compatible_device_models;
create policy product_compatible_device_models_staff_admin_all
  on public.product_compatible_device_models for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and product_compatible_device_models.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and product_compatible_device_models.organization_id = public.current_organization_id()
  );

-- ---------------------------------------------------------------------------
-- 18) RLS — integration, warranty, OS comments/photos/history
-- ---------------------------------------------------------------------------

drop policy if exists integration_webhooks_staff_admin_all on public.integration_webhooks;
create policy integration_webhooks_staff_admin_all
  on public.integration_webhooks for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and integration_webhooks.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and integration_webhooks.organization_id = public.current_organization_id()
  );

drop policy if exists warranty_templates_staff_admin_all on public.warranty_templates;
create policy warranty_templates_staff_admin_all
  on public.warranty_templates for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and warranty_templates.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and warranty_templates.organization_id = public.current_organization_id()
  );

drop policy if exists service_order_entry_photos_staff_admin_select on public.service_order_entry_photos;
drop policy if exists service_order_entry_photos_staff_admin_insert on public.service_order_entry_photos;
drop policy if exists service_order_entry_photos_staff_admin_delete on public.service_order_entry_photos;

create policy service_order_entry_photos_staff_admin_select
  on public.service_order_entry_photos for select
  to authenticated
  using (
    public.is_staff_or_admin()
    and service_order_entry_photos.organization_id = public.current_organization_id()
  );

create policy service_order_entry_photos_staff_admin_insert
  on public.service_order_entry_photos for insert
  to authenticated
  with check (
    public.is_staff_or_admin()
    and service_order_entry_photos.organization_id = public.current_organization_id()
  );

create policy service_order_entry_photos_staff_admin_delete
  on public.service_order_entry_photos for delete
  to authenticated
  using (
    public.is_staff_or_admin()
    and service_order_entry_photos.organization_id = public.current_organization_id()
  );

drop policy if exists service_order_assistance_comments_staff_admin_select on public.service_order_assistance_comments;
drop policy if exists service_order_assistance_comments_staff_admin_insert on public.service_order_assistance_comments;
drop policy if exists service_order_assistance_comments_staff_admin_update on public.service_order_assistance_comments;
drop policy if exists service_order_assistance_comments_staff_admin_delete on public.service_order_assistance_comments;
drop policy if exists service_order_assistance_comments_staff_all on public.service_order_assistance_comments;
create policy service_order_assistance_comments_staff_all
  on public.service_order_assistance_comments for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and service_order_assistance_comments.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and service_order_assistance_comments.organization_id = public.current_organization_id()
  );

drop policy if exists service_order_internal_comments_staff_admin_select on public.service_order_internal_comments;
drop policy if exists service_order_internal_comments_staff_admin_insert on public.service_order_internal_comments;
drop policy if exists service_order_internal_comments_staff_admin_update on public.service_order_internal_comments;
drop policy if exists service_order_internal_comments_staff_admin_delete on public.service_order_internal_comments;
drop policy if exists service_order_internal_comments_staff_all on public.service_order_internal_comments;
create policy service_order_internal_comments_staff_all
  on public.service_order_internal_comments for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and service_order_internal_comments.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and service_order_internal_comments.organization_id = public.current_organization_id()
  );

drop policy if exists service_order_edit_history_select_staff on public.service_order_edit_history;
drop policy if exists service_order_edit_history_insert_staff on public.service_order_edit_history;
drop policy if exists service_order_edit_history_delete_admin on public.service_order_edit_history;
drop policy if exists service_order_edit_history_select on public.service_order_edit_history;
drop policy if exists service_order_edit_history_insert on public.service_order_edit_history;
drop policy if exists service_order_edit_history_delete on public.service_order_edit_history;

create policy service_order_edit_history_select
  on public.service_order_edit_history for select
  to authenticated
  using (
    public.is_staff_or_admin()
    and service_order_edit_history.organization_id = public.current_organization_id()
  );

create policy service_order_edit_history_insert
  on public.service_order_edit_history for insert
  to authenticated
  with check (
    public.is_staff_or_admin()
    and service_order_edit_history.organization_id = public.current_organization_id()
    and service_order_edit_history.edited_by = auth.uid()
  );

create policy service_order_edit_history_delete
  on public.service_order_edit_history for delete
  to authenticated
  using (
    public.is_admin()
    and service_order_edit_history.organization_id = public.current_organization_id()
  );

drop policy if exists service_order_exit_photos_staff_admin_select on public.service_order_exit_photos;
drop policy if exists service_order_exit_photos_staff_admin_insert on public.service_order_exit_photos;
drop policy if exists service_order_exit_photos_staff_admin_delete on public.service_order_exit_photos;
drop policy if exists service_order_exit_photos_staff_admin_all on public.service_order_exit_photos;
create policy service_order_exit_photos_staff_admin_all
  on public.service_order_exit_photos for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and service_order_exit_photos.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and service_order_exit_photos.organization_id = public.current_organization_id()
  );

-- ---------------------------------------------------------------------------
-- 19) RLS — WhatsApp
-- ---------------------------------------------------------------------------

drop policy if exists whatsapp_conversations_staff_all on public.whatsapp_conversations;
create policy whatsapp_conversations_staff_all
  on public.whatsapp_conversations for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and whatsapp_conversations.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and whatsapp_conversations.organization_id = public.current_organization_id()
  );

drop policy if exists whatsapp_messages_staff_all on public.whatsapp_messages;
create policy whatsapp_messages_staff_all
  on public.whatsapp_messages for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and exists (
      select 1
      from public.whatsapp_conversations wc
      where wc.id = whatsapp_messages.conversation_id
        and wc.organization_id = public.current_organization_id()
    )
  )
  with check (
    public.is_staff_or_admin()
    and exists (
      select 1
      from public.whatsapp_conversations wc
      where wc.id = whatsapp_messages.conversation_id
        and wc.organization_id = public.current_organization_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 20) RLS — customer_portal_members (scoped to customer org)
-- ---------------------------------------------------------------------------

drop policy if exists customer_portal_members_staff_admin_all on public.customer_portal_members;
create policy customer_portal_members_staff_admin_all
  on public.customer_portal_members for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and public.customer_belongs_to_current_organization(customer_portal_members.customer_id)
  )
  with check (
    public.is_staff_or_admin()
    and public.customer_belongs_to_current_organization(customer_portal_members.customer_id)
  );

drop policy if exists customer_portal_members_select_own on public.customer_portal_members;
create policy customer_portal_members_select_own
  on public.customer_portal_members for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 21) RLS — device catalog (read all authenticated; write host context only)
-- ---------------------------------------------------------------------------

drop policy if exists device_models_staff_admin_all on public.device_models;
drop policy if exists device_models_retailer_select on public.device_models;

create policy device_models_select_authenticated
  on public.device_models for select
  to authenticated
  using (true);

create policy device_models_write_host_staff
  on public.device_models for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and public.is_host_organization_context()
  )
  with check (
    public.is_staff_or_admin()
    and public.is_host_organization_context()
  );

create policy device_models_retailer_select
  on public.device_models for select
  to authenticated
  using (public.is_retailer());

drop policy if exists device_brands_staff_admin_all on public.device_brands;
drop policy if exists device_brands_retailer_select on public.device_brands;

create policy device_brands_select_authenticated
  on public.device_brands for select
  to authenticated
  using (true);

create policy device_brands_write_host_staff
  on public.device_brands for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and public.is_host_organization_context()
  )
  with check (
    public.is_staff_or_admin()
    and public.is_host_organization_context()
  );

create policy device_brands_retailer_select
  on public.device_brands for select
  to authenticated
  using (public.is_retailer());

drop policy if exists device_types_staff_admin_all on public.device_types;
drop policy if exists device_types_retailer_select on public.device_types;

create policy device_types_select_authenticated
  on public.device_types for select
  to authenticated
  using (true);

create policy device_types_write_host_staff
  on public.device_types for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and public.is_host_organization_context()
  )
  with check (
    public.is_staff_or_admin()
    and public.is_host_organization_context()
  );

create policy device_types_retailer_select
  on public.device_types for select
  to authenticated
  using (public.is_retailer());

-- ---------------------------------------------------------------------------
-- 22) RLS — pricing retailer + staff overrides (org-scoped)
-- ---------------------------------------------------------------------------

drop policy if exists pricing_tags_retailer_select on public.pricing_tags;
create policy pricing_tags_retailer_select
  on public.pricing_tags for select
  to authenticated
  using (
    public.is_retailer()
    and exists (
      select 1
      from public.customer_portal_members m
      join public.customers c on c.id = m.customer_id
      where m.user_id = auth.uid()
        and c.organization_id = pricing_tags.organization_id
    )
  );

drop policy if exists pricing_tag_retailer_overrides_retailer_select_own on public.pricing_tag_retailer_overrides;
drop policy if exists pricing_tag_retailer_overrides_retailer_insert_own on public.pricing_tag_retailer_overrides;
drop policy if exists pricing_tag_retailer_overrides_retailer_update_own on public.pricing_tag_retailer_overrides;
drop policy if exists pricing_tag_retailer_overrides_retailer_all on public.pricing_tag_retailer_overrides;

create policy pricing_tag_retailer_overrides_retailer_select_own
  on public.pricing_tag_retailer_overrides for select
  to authenticated
  using (
    public.is_retailer()
    and retailer_user_id = auth.uid()
    and exists (
      select 1
      from public.pricing_tags pt
      join public.customer_portal_members m on m.user_id = auth.uid()
      join public.customers c on c.id = m.customer_id
      where pt.id = pricing_tag_retailer_overrides.pricing_tag_id
        and c.organization_id = pt.organization_id
    )
  );

create policy pricing_tag_retailer_overrides_retailer_insert_own
  on public.pricing_tag_retailer_overrides for insert
  to authenticated
  with check (
    public.is_retailer()
    and retailer_user_id = auth.uid()
    and exists (
      select 1
      from public.pricing_tags pt
      join public.customer_portal_members m on m.user_id = auth.uid()
      join public.customers c on c.id = m.customer_id
      where pt.id = pricing_tag_retailer_overrides.pricing_tag_id
        and c.organization_id = pt.organization_id
    )
  );

create policy pricing_tag_retailer_overrides_retailer_update_own
  on public.pricing_tag_retailer_overrides for update
  to authenticated
  using (
    public.is_retailer()
    and retailer_user_id = auth.uid()
    and exists (
      select 1
      from public.pricing_tags pt
      join public.customer_portal_members m on m.user_id = auth.uid()
      join public.customers c on c.id = m.customer_id
      where pt.id = pricing_tag_retailer_overrides.pricing_tag_id
        and c.organization_id = pt.organization_id
    )
  )
  with check (
    public.is_retailer()
    and retailer_user_id = auth.uid()
    and exists (
      select 1
      from public.pricing_tags pt
      join public.customer_portal_members m on m.user_id = auth.uid()
      join public.customers c on c.id = m.customer_id
      where pt.id = pricing_tag_retailer_overrides.pricing_tag_id
        and c.organization_id = pt.organization_id
    )
  );

drop policy if exists pricing_tag_retailer_overrides_staff_admin_all on public.pricing_tag_retailer_overrides;
create policy pricing_tag_retailer_overrides_staff_admin_all
  on public.pricing_tag_retailer_overrides for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and exists (
      select 1
      from public.pricing_tags pt
      where pt.id = pricing_tag_retailer_overrides.pricing_tag_id
        and pt.organization_id = public.current_organization_id()
    )
  )
  with check (
    public.is_staff_or_admin()
    and exists (
      select 1
      from public.pricing_tags pt
      where pt.id = pricing_tag_retailer_overrides.pricing_tag_id
        and pt.organization_id = public.current_organization_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 23) Storage — order photos scoped by org via join
-- ---------------------------------------------------------------------------

drop policy if exists order_entry_photos_staff_admin_all on storage.objects;
create policy order_entry_photos_staff_admin_all
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'order-entry-photos'
    and public.is_staff_or_admin()
    and exists (
      select 1
      from public.service_order_entry_photos p
      join public.service_orders s on s.id = p.service_order_id
      where p.storage_path = name
        and s.organization_id = public.current_organization_id()
    )
  )
  with check (
    bucket_id = 'order-entry-photos'
    and public.is_staff_or_admin()
    and exists (
      select 1
      from public.service_orders s
      where s.id::text = split_part(name, '/', 1)
        and s.organization_id = public.current_organization_id()
    )
  );

drop policy if exists order_exit_photos_staff_admin_all on storage.objects;
create policy order_exit_photos_staff_admin_all
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'order-exit-photos'
    and public.is_staff_or_admin()
    and exists (
      select 1
      from public.service_order_exit_photos p
      join public.service_orders s on s.id = p.service_order_id
      where p.storage_path = name
        and s.organization_id = public.current_organization_id()
    )
  )
  with check (
    bucket_id = 'order-exit-photos'
    and public.is_staff_or_admin()
    and exists (
      select 1
      from public.service_orders s
      where s.id::text = split_part(name, '/', 1)
        and s.organization_id = public.current_organization_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 24) Stock movement: copy organization_id from product on insert
-- ---------------------------------------------------------------------------

create or replace function public.trg_product_stock_movements_set_org ()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    select p.organization_id into new.organization_id
    from public.products p
    where p.id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists product_stock_movements_set_organization_id on public.product_stock_movements;
create trigger product_stock_movements_set_organization_id
  before insert on public.product_stock_movements
  for each row execute function public.trg_product_stock_movements_set_org ();

-- ---------------------------------------------------------------------------
-- 25) RPC: catálogo lojista filtrado por organização da loja
-- ---------------------------------------------------------------------------

create or replace function public.portal_retailer_catalog_prices (
  p_brand_id uuid default null,
  p_device_type_id uuid default null,
  p_device_model_id uuid default null
)
returns table (
  product_id uuid,
  product_name text,
  product_kind text,
  sale_price_cents integer,
  suggested_sale_cents integer,
  pricing_tag_id uuid,
  pricing_tag_name text,
  parts_family text,
  device_model_id uuid,
  device_model_label text,
  device_type_id uuid,
  device_type_name text,
  brand_id uuid,
  brand_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with retailer_orgs as (
    select distinct c.organization_id as org_id
    from public.customer_portal_members m
    join public.customers c on c.id = m.customer_id
    where m.user_id = auth.uid()
  ),
  filtered as (
    select
      p.id as product_id,
      p.name as product_name,
      p.kind::text as product_kind,
      p.sale_price_cents,
      p.pricing_tag_id,
      pt.name as pricing_tag_name,
      coalesce(p.parts_family, pt.parts_family)::text as parts_family,
      dm.id as device_model_id,
      dm.model as device_model_label,
      dt.id as device_type_id,
      dt.name as device_type_name,
      db.id as brand_id,
      db.name as brand_name,
      coalesce(o.margin_bps, pt.margin_bps, 0) as margin_bps_eff,
      coalesce(o.min_suggested_sale_cents, pt.min_suggested_sale_cents) as min_suggested_eff
    from public.products p
    left join public.pricing_tags pt on pt.id = p.pricing_tag_id
    left join public.product_compatible_device_models pcdm on pcdm.product_id = p.id
    left join public.device_models dm on dm.id = pcdm.device_model_id
    left join public.device_types dt on dt.id = dm.device_type_id
    left join public.device_brands db on db.id = dt.brand_id
    left join public.pricing_tag_retailer_overrides o
      on o.pricing_tag_id = pt.id
      and o.retailer_user_id = auth.uid()
    where p.is_active = true
      and (
        (public.is_staff_or_admin() and p.organization_id = public.current_organization_id())
        or (
          public.is_retailer()
          and p.organization_id in (select ro.org_id from retailer_orgs ro)
        )
      )
      and (
        (
          p_brand_id is null
          and p_device_type_id is null
          and p_device_model_id is null
        )
        or (
          pcdm.product_id is not null
          and (p_device_model_id is null or pcdm.device_model_id = p_device_model_id)
          and (p_device_type_id is null or dt.id = p_device_type_id)
          and (p_brand_id is null or db.id = p_brand_id)
        )
      )
  ),
  calc as (
    select
      f.*,
      case
        when f.sale_price_cents is null then null::integer
        when f.margin_bps_eff <= 0 or f.margin_bps_eff >= 10000 then f.sale_price_cents
        else ceil(f.sale_price_cents::numeric * 10000.0 / (10000 - f.margin_bps_eff))::integer
      end as by_margin_cents
    from filtered f
  )
  select
    c.product_id,
    c.product_name,
    c.product_kind,
    c.sale_price_cents,
    case
      when c.by_margin_cents is null then null::integer
      else greatest(
        c.by_margin_cents,
        coalesce(c.min_suggested_eff, c.by_margin_cents)
      )
    end as suggested_sale_cents,
    c.pricing_tag_id,
    c.pricing_tag_name,
    c.parts_family,
    c.device_model_id,
    c.device_model_label,
    c.device_type_id,
    c.device_type_name,
    c.brand_id,
    c.brand_name
  from calc c;
$$;

revoke all on function public.portal_retailer_catalog_prices (uuid, uuid, uuid) from public;
grant execute on function public.portal_retailer_catalog_prices (uuid, uuid, uuid) to authenticated;
