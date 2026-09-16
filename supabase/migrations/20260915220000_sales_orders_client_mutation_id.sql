-- Idempotência de checkout offline (PDV): evita venda duplicada em retry.
alter table public.sales_orders
  add column if not exists client_mutation_id uuid null;

comment on column public.sales_orders.client_mutation_id is
  'ID da mutação gerado no cliente (fila offline). Unique por organização.';

create unique index if not exists sales_orders_org_client_mutation_id_uidx
  on public.sales_orders (organization_id, client_mutation_id)
  where client_mutation_id is not null;
