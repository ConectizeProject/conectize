-- Migra internal_description legado para service_order_internal_comments e remove a coluna.
-- Data do comentário: fechamento da OS (closed_at) quando existir; senão abertura (created_at).
-- Só insere se a coluna existir (baseline local não inclui internal_description / closed_at de add_*.sql ignorados).

do $$
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'service_orders'
      and c.column_name = 'internal_description'
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
        trim(o.internal_description),
        coalesce(o.closed_at, o.created_at)
      from public.service_orders o
      where length(trim(coalesce(o.internal_description, ''))) > 0;
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
        trim(o.internal_description),
        o.created_at
      from public.service_orders o
      where length(trim(coalesce(o.internal_description, ''))) > 0;
    end if;
  end if;
end $$;

alter table public.service_orders
  drop column if exists internal_description;
