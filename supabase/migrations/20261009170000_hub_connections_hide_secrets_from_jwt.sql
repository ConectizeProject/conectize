-- Staff (e o JWT authenticated em geral) nao pode ler tokens/chaves do Hub
-- via PostgREST. A policy hub_connections_staff_select continua permitindo
-- SELECT de metadados (inbox, status da conexao), mas as colunas secretas
-- so existem no GRANT de service_role.
--
-- Escrita (INSERT/UPDATE/DELETE) segue nas policies admin; RETURNING dessas
-- colunas secretas tambem fica bloqueado no JWT.

revoke all on table public.hub_connections from anon;

revoke select on table public.hub_connections from authenticated;

grant select (
  id,
  organization_id,
  platform_id,
  token_expires_at,
  metadata,
  created_by,
  created_at,
  updated_at
) on table public.hub_connections to authenticated;

grant insert, update, delete on table public.hub_connections to authenticated;

grant all on table public.hub_connections to postgres, service_role;
