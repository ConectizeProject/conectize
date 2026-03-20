-- Lista de produtos: agrega estoque e última entrada em uma query (evita até 10k linhas no app).
create index if not exists product_stock_movements_product_id_idx
  on public.product_stock_movements (product_id);

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
begin
  if not public.is_staff_or_admin() then
    raise exception 'forbidden';
  end if;

  if p_product_ids is null or coalesce(array_length(p_product_ids, 1), 0) = 0 then
    return;
  end if;

  return query
  with agg as (
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
    where m.product_id = any (p_product_ids)
    group by m.product_id
  ),
  last_in as (
    select distinct on (m.product_id)
      m.product_id,
      m.unit_value_cents,
      m.created_at
    from public.product_stock_movements m
    where m.product_id = any (p_product_ids)
      and lower(m.type::text) = 'entry'
      and coalesce(m.unit_value_cents, 0) > 0
    order by m.product_id, m.created_at desc
  )
  select
    u.id as product_id,
    coalesce(agg.current_stock, 0) as current_stock,
    coalesce(agg.has_movements, false) as has_movements,
    li.unit_value_cents::bigint as last_entry_unit_value_cents,
    li.created_at as last_entry_created_at
  from unnest(p_product_ids) as u(id)
  left join agg on agg.product_id = u.id
  left join last_in li on li.product_id = u.id;
end;
$$;

grant execute on function public.portal_products_list_stock_summary (uuid[]) to authenticated;
