-- Acelera snapshot/busca do PDV por organização.
-- Catálogo: filtro ativo + kind product, ordenado por nome.
-- Lookups exatos de barcode/sku (leitor e Enter).

create index if not exists products_pdv_catalog_org_name_idx
  on public.products (organization_id, name)
  where is_active = true and kind = 'product';

create index if not exists products_pdv_org_barcode_idx
  on public.products (organization_id, barcode)
  where barcode is not null
    and btrim(barcode) <> ''
    and is_active = true
    and kind = 'product';

create index if not exists products_pdv_org_sku_idx
  on public.products (organization_id, lower(sku))
  where sku is not null
    and btrim(sku) <> ''
    and is_active = true
    and kind = 'product';
