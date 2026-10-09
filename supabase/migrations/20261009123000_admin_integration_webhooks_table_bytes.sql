-- Tamanho em disco da tabela de webhooks (dados, toast e índices).

create or replace function public.admin_integration_webhooks_table_bytes()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' and not public.is_admin() then
    raise exception 'forbidden';
  end if;

  return pg_total_relation_size('public.integration_webhooks'::regclass);
end;
$$;

revoke all on function public.admin_integration_webhooks_table_bytes() from public;
grant execute on function public.admin_integration_webhooks_table_bytes() to authenticated;
grant execute on function public.admin_integration_webhooks_table_bytes() to service_role;
