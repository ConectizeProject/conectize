-- Tarifas MELI persistidas (evita depender de live enrich a cada listagem).
alter table public.sales_orders
  add column if not exists ml_sale_fee_cents integer null,
  add column if not exists ml_shipping_gross_cents integer null,
  add column if not exists ml_shipping_refund_cents integer null;

alter table public.sales_orders
  drop constraint if exists sales_orders_ml_sale_fee_cents_check;
alter table public.sales_orders
  add constraint sales_orders_ml_sale_fee_cents_check
  check (ml_sale_fee_cents is null or ml_sale_fee_cents >= 0);

alter table public.sales_orders
  drop constraint if exists sales_orders_ml_shipping_gross_cents_check;
alter table public.sales_orders
  add constraint sales_orders_ml_shipping_gross_cents_check
  check (ml_shipping_gross_cents is null or ml_shipping_gross_cents >= 0);

alter table public.sales_orders
  drop constraint if exists sales_orders_ml_shipping_refund_cents_check;
alter table public.sales_orders
  add constraint sales_orders_ml_shipping_refund_cents_check
  check (ml_shipping_refund_cents is null or ml_shipping_refund_cents >= 0);

comment on column public.sales_orders.ml_sale_fee_cents is
  'Tarifa de venda MELI (sale_fee × qty), em centavos. Null = ainda não sincronizado.';
comment on column public.sales_orders.ml_shipping_gross_cents is
  'Custo de frete do vendedor MELI, em centavos. Null = ainda não sincronizado.';
comment on column public.sales_orders.ml_shipping_refund_cents is
  'Reembolso/subsídio de frete MELI, em centavos. Null = ainda não sincronizado.';

-- Desconto promocional MELI (informativo; unit_price já vem líquido).
alter table public.sales_order_items
  add column if not exists ml_discount_total_cents integer null,
  add column if not exists ml_discount_seller_cents integer null;

alter table public.sales_order_items
  drop constraint if exists sales_order_items_ml_discount_total_cents_check;
alter table public.sales_order_items
  add constraint sales_order_items_ml_discount_total_cents_check
  check (ml_discount_total_cents is null or ml_discount_total_cents >= 0);

alter table public.sales_order_items
  drop constraint if exists sales_order_items_ml_discount_seller_cents_check;
alter table public.sales_order_items
  add constraint sales_order_items_ml_discount_seller_cents_check
  check (ml_discount_seller_cents is null or ml_discount_seller_cents >= 0);

comment on column public.sales_order_items.ml_discount_total_cents is
  'Desconto total promocional MELI no item (centavos). Não entra no subtotal.';
comment on column public.sales_order_items.ml_discount_seller_cents is
  'Parcela do desconto custeada pelo vendedor (centavos).';
