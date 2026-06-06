-- Marcas (apenas texto)
create table if not exists public.device_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists device_brands_name_idx on public.device_brands(name);
alter table public.device_brands enable row level security;

drop policy if exists device_brands_staff_admin_all on public.device_brands;
create policy "device_brands_staff_admin_all"
  on public.device_brands for all to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- Tipos de dispositivo (marca + texto)
create table if not exists public.device_types (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.device_brands(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint device_types_brand_name_unique unique (brand_id, name)
);

create index if not exists device_types_brand_id_idx on public.device_types(brand_id);
create index if not exists device_types_name_idx on public.device_types(name);
alter table public.device_types enable row level security;

drop policy if exists device_types_staff_admin_all on public.device_types;
create policy "device_types_staff_admin_all"
  on public.device_types for all to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- Colunas opcionais em device_models para referenciar as novas tabelas (mantém brand/device_type/model para compatibilidade com OS)
alter table public.device_models
  add column if not exists brand_id uuid null references public.device_brands(id) on delete set null,
  add column if not exists device_type_id uuid null references public.device_types(id) on delete set null;

-- Backfill só se brand/device_type ainda existirem (cloud já removeu essas colunas).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'device_models' and column_name = 'brand'
  ) then
    return;
  end if;

  insert into public.device_brands (name)
  select distinct trim(brand)
  from public.device_models
  where trim(coalesce(brand, '')) <> ''
  on conflict (name) do nothing;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'device_models' and column_name = 'device_type'
  ) then
    insert into public.device_types (brand_id, name)
    select distinct b.id, trim(dm.device_type)
    from public.device_models dm
    join public.device_brands b on b.name = trim(dm.brand)
    where trim(coalesce(dm.device_type, '')) <> ''
    on conflict (brand_id, name) do nothing;

    update public.device_models dm
    set brand_id = b.id
    from public.device_brands b
    where dm.brand is not null and trim(dm.brand) = b.name and dm.brand_id is null;

    update public.device_models dm
    set device_type_id = t.id
    from public.device_types t
    join public.device_brands b on t.brand_id = b.id
    where dm.brand is not null and dm.device_type is not null
      and trim(dm.brand) = b.name and trim(dm.device_type) = t.name
      and dm.device_type_id is null;
  end if;
end $$;
