-- Catálogo do PDV inclui produtos e serviços (kind só admite esses dois valores).
drop index if exists public.products_pdv_catalog_org_name_idx;
drop index if exists public.products_pdv_org_barcode_idx;
drop index if exists public.products_pdv_org_sku_idx;

create index if not exists products_pdv_catalog_org_name_idx
  on public.products (organization_id, name)
  where is_active = true;

create index if not exists products_pdv_org_barcode_idx
  on public.products (organization_id, barcode)
  where barcode is not null
    and btrim(barcode) <> ''
    and is_active = true;

create index if not exists products_pdv_org_sku_idx
  on public.products (organization_id, lower(sku))
  where sku is not null
    and btrim(sku) <> ''
    and is_active = true;
