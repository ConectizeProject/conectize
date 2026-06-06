-- Alinha customer_type com valores usados no portal (pessoa_fisica / pessoa_juridica).

update public.sales_orders
set customer_type = 'pessoa_fisica'
where customer_type in ('pf', 'f', 'F');

update public.sales_orders
set customer_type = 'pessoa_juridica'
where customer_type in ('pj', 'j', 'J');

alter table public.sales_orders
  drop constraint if exists sales_orders_customer_type_check;

alter table public.sales_orders
  alter column customer_type set default 'pessoa_fisica';

update public.sales_orders
set customer_type = 'pessoa_fisica'
where customer_type is null;

alter table public.sales_orders
  alter column customer_type set not null;

alter table public.sales_orders
  add constraint sales_orders_customer_type_check
  check (customer_type in ('pessoa_fisica', 'pessoa_juridica'));
