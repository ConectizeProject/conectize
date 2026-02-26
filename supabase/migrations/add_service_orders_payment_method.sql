-- Adiciona método de pagamento e parcelas em service_orders
alter table public.service_orders
  add column if not exists payment_method_id uuid,
  add column if not exists installments integer;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'service_orders_payment_method_id_fkey'
  ) then
    alter table public.service_orders
      add constraint service_orders_payment_method_id_fkey
      foreign key (payment_method_id) references public.payment_methods(id) on delete set null;
  end if;
end $$;
