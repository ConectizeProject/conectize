-- NF-e de entrada unificada: produtos (XML/manual) e usados (aparelhos).

alter table public.inbound_nfe_documents
  add column if not exists entry_kind text not null default 'products';

alter table public.inbound_nfe_documents
  drop constraint if exists inbound_nfe_documents_entry_kind_check;

alter table public.inbound_nfe_documents
  add constraint inbound_nfe_documents_entry_kind_check
  check (entry_kind in ('products', 'used_devices'));

alter table public.inbound_nfe_documents
  add column if not exists source_mode text not null default 'xml';

alter table public.inbound_nfe_documents
  drop constraint if exists inbound_nfe_documents_source_mode_check;

alter table public.inbound_nfe_documents
  add constraint inbound_nfe_documents_source_mode_check
  check (source_mode in ('xml', 'manual'));

alter table public.inbound_nfe_documents
  alter column access_key drop not null;

alter table public.inbound_nfe_documents
  alter column xml_content drop not null;

alter table public.inbound_nfe_documents
  drop constraint if exists inbound_nfe_documents_access_key_uniq;

drop index if exists inbound_nfe_documents_access_key_uniq;

create unique index if not exists inbound_nfe_documents_access_key_uniq
  on public.inbound_nfe_documents (organization_id, access_key)
  where access_key is not null;

alter table public.inbound_nfe_documents
  add column if not exists seller_customer_id uuid null references public.customers (id) on delete set null;

alter table public.inbound_nfe_documents
  add column if not exists seller_name text null;

alter table public.inbound_nfe_documents
  add column if not exists seller_document text null;

alter table public.inbound_nfe_documents
  add column if not exists purchase_payment_methods jsonb null;

alter table public.inbound_nfe_items
  add column if not exists item_kind text not null default 'product';

alter table public.inbound_nfe_items
  drop constraint if exists inbound_nfe_items_item_kind_check;

alter table public.inbound_nfe_items
  add constraint inbound_nfe_items_item_kind_check
  check (item_kind in ('product', 'used_device'));

alter table public.inbound_nfe_items
  add column if not exists resale_device_id uuid null references public.resale_devices (id) on delete set null;

alter table public.inbound_nfe_items
  add column if not exists device_snapshot jsonb null;

create index if not exists inbound_nfe_items_resale_device_idx
  on public.inbound_nfe_items (resale_device_id)
  where resale_device_id is not null;

comment on column public.inbound_nfe_documents.entry_kind is
  'products = mercadoria nova; used_devices = aparelhos usados/seminovos.';
comment on column public.inbound_nfe_documents.source_mode is
  'xml = importação de XML; manual = cadastro sem XML.';
