-- Produto pai (com variações) não guarda estoque: o saldo fica só nos filhos.

create or replace function public.product_has_variation_children (p_product_id uuid)
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
        exists (
          select 1
          from public.products c
          where c.parent_product_id = p.id
        )
        or (
          p.bling_id is not null
          and btrim(p.bling_id) <> ''
          and exists (
            select 1
            from public.products c
            where c.parent_bling_id = p.bling_id
          )
        )
      )
  );
$$;

comment on function public.product_has_variation_children (uuid) is
  'True se o produto tem pelo menos uma variação (filho).';

create or replace function public.trg_reject_stock_on_parent_product ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.product_has_variation_children(new.product_id) then
    raise exception 'parent_product_cannot_have_stock'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists product_stock_movements_reject_parent on public.product_stock_movements;
create trigger product_stock_movements_reject_parent
  before insert or update of product_id
  on public.product_stock_movements
  for each row
  execute function public.trg_reject_stock_on_parent_product ();

create or replace function public.trg_clear_parent_product_stock ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_ids uuid[] := '{}';
begin
  if new.parent_product_id is not null then
    parent_ids := array_append(parent_ids, new.parent_product_id);
  end if;

  if new.parent_bling_id is not null and btrim(new.parent_bling_id) <> '' then
    parent_ids := parent_ids || array(
      select p.id
      from public.products p
      where p.bling_id = new.parent_bling_id
        and p.parent_bling_id is null
        and p.parent_product_id is null
    );
  end if;

  if parent_ids is not null and array_length(parent_ids, 1) is not null then
    delete from public.product_stock_movements
    where product_id = any (parent_ids);
  end if;

  return new;
end;
$$;

drop trigger if exists products_clear_parent_stock on public.products;
create trigger products_clear_parent_stock
  after insert or update of parent_product_id, parent_bling_id
  on public.products
  for each row
  when (
    new.parent_product_id is not null
    or (new.parent_bling_id is not null and btrim(new.parent_bling_id) <> '')
  )
  execute function public.trg_clear_parent_product_stock ();

delete from public.product_stock_movements m
using public.products p
where m.product_id = p.id
  and public.product_has_variation_children(p.id);
