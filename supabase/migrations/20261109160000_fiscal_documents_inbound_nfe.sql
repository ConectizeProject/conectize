alter table public.fiscal_documents
  add column if not exists inbound_nfe_id uuid
  references public.inbound_nfe_documents(id) on delete set null;

alter table public.fiscal_documents
  drop constraint if exists fiscal_documents_one_source;

alter table public.fiscal_documents
  add constraint fiscal_documents_one_source check (
    num_nonnulls(sales_order_id, service_order_id, inbound_nfe_id) = 1
  );

create unique index if not exists fiscal_documents_inbound_nfe_active_uniq
  on public.fiscal_documents (organization_id, inbound_nfe_id)
  where inbound_nfe_id is not null and status <> 'canceled';

create index if not exists fiscal_documents_inbound_nfe_idx
  on public.fiscal_documents (inbound_nfe_id)
  where inbound_nfe_id is not null;
