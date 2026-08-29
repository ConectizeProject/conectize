-- Cache local de anúncios do Mercado Livre (vitrine + vínculo com products).

create table if not exists public.meli_listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ml_item_id text not null,
  product_id uuid null references public.products (id) on delete set null,
  title text not null default '',
  permalink text null,
  thumbnail_url text null,
  status text not null default 'unknown',
  price_cents integer null check (price_cents is null or price_cents >= 0),
  available_quantity integer null,
  sold_quantity integer null,
  seller_sku text null,
  category_id text null,
  pictures jsonb null,
  raw jsonb null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meli_listings_org_ml_item_key unique (organization_id, ml_item_id)
);

create index if not exists meli_listings_org_status_idx
  on public.meli_listings (organization_id, status);

create index if not exists meli_listings_org_product_id_idx
  on public.meli_listings (organization_id, product_id)
  where product_id is not null;

create index if not exists meli_listings_org_synced_at_idx
  on public.meli_listings (organization_id, synced_at desc);

create or replace function public.meli_listings_touch_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists meli_listings_touch_updated_at_trigger on public.meli_listings;
create trigger meli_listings_touch_updated_at_trigger
  before update on public.meli_listings
  for each row execute function public.meli_listings_touch_updated_at();

alter table public.meli_listings enable row level security;

drop policy if exists meli_listings_staff_admin_all on public.meli_listings;
create policy meli_listings_staff_admin_all
  on public.meli_listings for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and meli_listings.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and meli_listings.organization_id = public.current_organization_id()
  );

grant select, insert, update, delete on public.meli_listings to postgres, service_role, authenticated;
