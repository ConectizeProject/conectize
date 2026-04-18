-- Copia assistance_info legado para o chat da assistência e remove a coluna.
-- Data do comentário: fechamento da OS (closed_at) quando existir; senão abertura (created_at).
-- Só insere se a coluna existir (baseline local não inclui assistance_info / closed_at de add_*.sql ignorados).

do $$
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'service_orders'
      and c.column_name = 'assistance_info'
  ) then
    if exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'service_orders'
        and c.column_name = 'closed_at'
    ) then
      insert into public.service_order_assistance_comments (
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
        trim(o.assistance_info),
        coalesce(o.closed_at, o.created_at)
      from public.service_orders o
      where length(trim(coalesce(o.assistance_info, ''))) > 0;
    else
      insert into public.service_order_assistance_comments (
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
        trim(o.assistance_info),
        o.created_at
      from public.service_orders o
      where length(trim(coalesce(o.assistance_info, ''))) > 0;
    end if;
  end if;
end $$;

alter table public.service_orders
  drop column if exists assistance_info;
