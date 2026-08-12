-- Remove colunas legadas de service_orders:
-- - description (substituída por customer_description / receiving_notes / comentários internos)
-- - payment_method_id / installments (substituídas por payment_methods jsonb)

do $$
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'service_orders'
      and c.column_name = 'description'
  ) then
    if exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'service_orders'
        and c.column_name = 'closed_at'
    ) then
      insert into public.service_order_internal_comments (
        service_order_id,
        author_user_id,
        author_display_name,
        content,
        created_at
      )
      select
        o.id,
        null,
        'Histórico (migrado)',
        trim(o.description),
        coalesce(o.closed_at, o.created_at)
      from public.service_orders o
      where length(trim(coalesce(o.description, ''))) > 0;
    else
      insert into public.service_order_internal_comments (
        service_order_id,
        author_user_id,
        author_display_name,
        content,
        created_at
      )
      select
        o.id,
        null,
        'Histórico (migrado)',
        trim(o.description),
        o.created_at
      from public.service_orders o
      where length(trim(coalesce(o.description, ''))) > 0;
    end if;
  end if;
end $$;

alter table public.service_orders
  drop column if exists description,
  drop column if exists payment_method_id,
  drop column if exists installments;
