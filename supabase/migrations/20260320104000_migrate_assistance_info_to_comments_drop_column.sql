-- Copia assistance_info legado para o chat da assistência e remove a coluna.
-- Data do comentário: fechamento da OS (closed_at) quando existir; senão abertura (created_at).

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

alter table public.service_orders
  drop column if exists assistance_info;
