-- Isola o resumo de estoque do PDV/catálogo pela organização ativa.
-- A função é SECURITY DEFINER e antes somava movimentos só por product_id,
-- o que podia misturar estoque entre empresas.

create or replace function public.portal_products_list_stock_summary (p_product_ids uuid[])
returns table (
  product_id uuid,
  current_stock numeric,
  has_movements boolean,
  last_entry_unit_value_cents bigint,
  last_entry_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.current_organization_id();
begin
  if not public.is_staff_or_admin() then
    raise exception 'forbidden';
  end if;

  if v_org_id is null then
    raise exception 'no_organization_context';
  end if;

  if p_product_ids is null or coalesce(array_length(p_product_ids, 1), 0) = 0 then
    return;
  end if;

  return query
  with org_products as (
    select p.id
    from public.products p
    where p.id = any (p_product_ids)
      and p.organization_id = v_org_id
  ),
  agg as (
    select
      m.product_id,
      sum(
        case lower(m.type::text)
          when 'entry' then coalesce(m.quantity, 0)::numeric
          when 'exit' then -coalesce(m.quantity, 0)::numeric
          when 'loss' then -coalesce(m.quantity, 0)::numeric
          else 0::numeric
        end
      ) as current_stock,
      true as has_movements
    from public.product_stock_movements m
    where m.product_id in (select id from org_products)
      and m.organization_id = v_org_id
    group by m.product_id
  ),
  last_in as (
    select distinct on (m.product_id)
      m.product_id,
      m.unit_value_cents,
      m.created_at
    from public.product_stock_movements m
    where m.product_id in (select id from org_products)
      and m.organization_id = v_org_id
      and lower(m.type::text) = 'entry'
      and coalesce(m.unit_value_cents, 0) > 0
    order by m.product_id, m.created_at desc
  )
  select
    op.id as product_id,
    coalesce(agg.current_stock, 0) as current_stock,
    coalesce(agg.has_movements, false) as has_movements,
    li.unit_value_cents::bigint as last_entry_unit_value_cents,
    li.created_at as last_entry_created_at
  from org_products op
  left join agg on agg.product_id = op.id
  left join last_in li on li.product_id = op.id;
end;
$$;

grant execute on function public.portal_products_list_stock_summary (uuid[]) to authenticated;
