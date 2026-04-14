-- Perfil lojista B2B: role retailer, membros por loja, RLS e leitura varejo/storage

-- =========================
-- Role retailer
-- =========================

alter table public.users drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check check (role in ('user', 'staff', 'admin', 'retailer'));

-- =========================
-- is_retailer()
-- =========================

create or replace function public.is_retailer ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'retailer'
  );
$$;

-- =========================
-- customer_portal_members (N usuários por loja; 1 usuário = 1 loja)
-- =========================

create table if not exists public.customer_portal_members (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists customer_portal_members_customer_id_idx
  on public.customer_portal_members (customer_id);

create index if not exists customer_portal_members_user_id_idx
  on public.customer_portal_members (user_id);

alter table public.customer_portal_members enable row level security;

drop policy if exists "customer_portal_members_select_own" on public.customer_portal_members;
create policy "customer_portal_members_select_own"
on public.customer_portal_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "customer_portal_members_staff_admin_all" on public.customer_portal_members;
create policy "customer_portal_members_staff_admin_all"
on public.customer_portal_members
for all
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

-- =========================
-- service_orders: lojista vê OS da loja (membro)
-- =========================

drop policy if exists "service_orders_customer_select_own" on public.service_orders;

create policy "service_orders_customer_select_own"
on public.service_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = service_orders.customer_id
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

-- =========================
-- customers: leitura para membro portal
-- =========================

drop policy if exists "customers_select_own" on public.customers;

create policy "customers_select_own"
on public.customers
for select
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

-- =========================
-- Varejo: leitura para retailer
-- =========================

drop policy if exists "resale_devices_retailer_select" on public.resale_devices;
create policy "resale_devices_retailer_select"
on public.resale_devices
for select
to authenticated
using (public.is_retailer());

drop policy if exists "resale_device_costs_retailer_select" on public.resale_device_costs;
create policy "resale_device_costs_retailer_select"
on public.resale_device_costs
for select
to authenticated
using (public.is_retailer());

drop policy if exists "payment_methods_retailer_select" on public.payment_methods;
create policy "payment_methods_retailer_select"
on public.payment_methods
for select
to authenticated
using (public.is_retailer());

-- =========================
-- Storage: fotos revenda (signed URL)
-- =========================

drop policy if exists "resale_device_photos_retailer_select" on storage.objects;
create policy "resale_device_photos_retailer_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resale-device-photos'
  and public.is_retailer()
);
