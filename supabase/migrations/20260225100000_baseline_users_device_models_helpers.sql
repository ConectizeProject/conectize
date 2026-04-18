-- Baseline para `supabase db reset` / CLI local.
-- Vários SQLs antigos estão fora do padrão <timestamp>_nome.sql e são ignorados pelo CLI;
-- a primeira migração com timestamp já referenciava public.is_staff_or_admin() sem esta base.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user',
  full_name text,
  cpf text,
  phone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.device_models (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  device_type text not null,
  model text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists device_models_unique
  on public.device_models(brand, device_type, model);

create index if not exists device_models_brand_idx on public.device_models(brand);
create index if not exists device_models_device_type_idx on public.device_models(device_type);
create index if not exists device_models_model_idx on public.device_models(model);

create or replace function public.is_admin ()
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
      and u.role = 'admin'
  );
$$;

create or replace function public.is_staff_or_admin ()
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
      and u.role in ('staff', 'admin')
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.is_staff_or_admin() from public;
grant execute on function public.is_staff_or_admin() to authenticated;

alter table public.users enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own
  on public.users for select to authenticated
  using (id = auth.uid());

drop policy if exists users_select_staff_or_admin on public.users;
create policy users_select_staff_or_admin
  on public.users for select to authenticated
  using (public.is_staff_or_admin());

alter table public.device_models enable row level security;

drop policy if exists device_models_staff_admin_all on public.device_models;
create policy device_models_staff_admin_all
  on public.device_models for all to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on public.users to postgres, service_role;
grant select, insert, update, delete on public.users to authenticated;

grant select, insert, update, delete on public.device_models to postgres, service_role;
grant select, insert, update, delete on public.device_models to authenticated;
