-- Corrige numeração global (IDENTITY) para sequência independente por organização.

create or replace function public.sales_orders_assign_order_number ()
returns trigger
language plpgsql
as $$
declare
  next_num bigint;
begin
  if new.order_number is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.organization_id::text));

  select coalesce(max(s.order_number), 0) + 1
  into next_num
  from public.sales_orders s
  where s.organization_id = new.organization_id;

  new.order_number := next_num;
  return new;
end;
$$;

alter table public.sales_orders
  alter column order_number drop identity if exists;

-- Renumera pedidos existentes: 1, 2, 3… dentro de cada empresa.
with ranked as (
  select
    id,
    row_number() over (
      partition by organization_id
      order by created_at asc, id asc
    )::bigint as rn
  from public.sales_orders
)
update public.sales_orders o
set order_number = r.rn
from ranked r
where o.id = r.id;

alter table public.sales_orders
  alter column order_number set not null;

drop trigger if exists sales_orders_assign_order_number_trg on public.sales_orders;
create trigger sales_orders_assign_order_number_trg
  before insert on public.sales_orders
  for each row
  execute function public.sales_orders_assign_order_number();
