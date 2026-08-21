-- NF-e de entrada (importação de XML de fornecedor) + origem de estoque.

alter table public.product_stock_movements
  drop constraint if exists product_stock_movements_source_check;

alter table public.product_stock_movements
  add constraint product_stock_movements_source_check
  check (source in ('manual', 'bling', 'system', 'pdv_sale', 'service_order', 'sales_order', 'nfe_entrada'));

create table if not exists public.inbound_nfe_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  access_key text not null,
  series integer not null check (series > 0),
  number bigint not null check (number > 0),
  issued_at timestamptz null,
  issuer_cnpj text null,
  issuer_name text null,
  recipient_cnpj text null,
  recipient_name text null,
  total_cents bigint not null default 0 check (total_cents >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'posted', 'canceled')),
  xml_content text not null,
  notes text null,
  posted_at timestamptz null,
  posted_by uuid null references auth.users (id) on delete set null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbound_nfe_documents_access_key_uniq unique (organization_id, access_key)
);

create index if not exists inbound_nfe_documents_org_created_idx
  on public.inbound_nfe_documents (organization_id, created_at desc);

create index if not exists inbound_nfe_documents_org_status_idx
  on public.inbound_nfe_documents (organization_id, status, created_at desc);

create table if not exists public.inbound_nfe_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inbound_nfe_id uuid not null references public.inbound_nfe_documents (id) on delete cascade,
  line_number integer not null check (line_number > 0),
  product_code text null,
  barcode text null,
  description text not null,
  ncm text null,
  cest text null,
  unit text null,
  quantity numeric(18, 4) not null check (quantity > 0),
  unit_value_cents bigint not null default 0 check (unit_value_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  product_id uuid null references public.products (id) on delete set null,
  stock_movement_id uuid null references public.product_stock_movements (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbound_nfe_items_line_uniq unique (inbound_nfe_id, line_number)
);

create index if not exists inbound_nfe_items_doc_idx
  on public.inbound_nfe_items (inbound_nfe_id, line_number);

create index if not exists inbound_nfe_items_product_idx
  on public.inbound_nfe_items (product_id)
  where product_id is not null;

alter table public.inbound_nfe_documents enable row level security;
alter table public.inbound_nfe_items enable row level security;

drop policy if exists inbound_nfe_documents_staff_all on public.inbound_nfe_documents;
create policy inbound_nfe_documents_staff_all
  on public.inbound_nfe_documents for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and organization_id = public.current_organization_id()
  );

drop policy if exists inbound_nfe_items_staff_all on public.inbound_nfe_items;
create policy inbound_nfe_items_staff_all
  on public.inbound_nfe_items for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and organization_id = public.current_organization_id()
  );

grant select, insert, update, delete on public.inbound_nfe_documents to authenticated;
grant select, insert, update, delete on public.inbound_nfe_items to authenticated;
grant select, insert, update, delete on public.inbound_nfe_documents to service_role;
grant select, insert, update, delete on public.inbound_nfe_items to service_role;
