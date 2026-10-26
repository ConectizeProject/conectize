-- Status da reclamação/mediação MELI (opened | closed).
alter table public.sales_orders
  add column if not exists ml_claim_status text null;
