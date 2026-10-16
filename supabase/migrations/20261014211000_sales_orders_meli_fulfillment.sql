alter table public.sales_orders
  add column if not exists ml_shipment_id text null,
  add column if not exists ml_shipment_status text null,
  add column if not exists ml_shipment_substatus text null,
  add column if not exists ml_logistic_type text null,
  add column if not exists ml_fulfillment_stage text null;

create index if not exists sales_orders_org_ml_shipment_id_idx
  on public.sales_orders (organization_id, ml_shipment_id)
  where ml_shipment_id is not null;

create index if not exists sales_orders_org_ml_fulfillment_stage_idx
  on public.sales_orders (organization_id, status, ml_fulfillment_stage)
  where ml_order_id is not null;
