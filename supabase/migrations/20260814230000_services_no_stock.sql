-- Serviço não guarda estoque; reforça o bloqueio já existente para produto pai.

create or replace function public.product_is_stockless (p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and (
        p.kind = 'service'
        or public.product_has_variation_children(p.id)
      )
  );
$$;

comment on function public.product_is_stockless (uuid) is
  'True se o cadastro é serviço ou produto pai com variações (sem estoque próprio).';

create or replace function public.trg_reject_stock_on_parent_product ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.product_is_stockless(new.product_id) then
    raise exception 'product_cannot_have_stock'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.trg_clear_stock_when_product_becomes_service ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.product_stock_movements
  where product_id = new.id;
  return new;
end;
$$;

drop trigger if exists products_clear_stock_on_service on public.products;
create trigger products_clear_stock_on_service
  after insert or update of kind
  on public.products
  for each row
  when (new.kind = 'service')
  execute function public.trg_clear_stock_when_product_becomes_service ();

delete from public.product_stock_movements m
using public.products p
where m.product_id = p.id
  and p.kind = 'service';
