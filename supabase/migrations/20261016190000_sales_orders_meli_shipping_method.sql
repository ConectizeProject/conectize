-- Nome do método de envio (ex.: Agência Mercado Livre) para o painel de envios.
alter table public.sales_orders
  add column if not exists ml_shipping_method text null;
