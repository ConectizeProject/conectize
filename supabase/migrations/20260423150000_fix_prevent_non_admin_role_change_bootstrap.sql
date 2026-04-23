-- Permite UPDATE de role via SQL Editor / migrações quando auth.uid() é null.
-- O trigger antes exigia is_platform_admin() ou is_admin(), ambos falsos sem JWT.

create or replace function public.prevent_non_admin_role_change ()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null
       and not (
      public.is_platform_admin()
      or public.is_admin()
    ) then
      raise exception 'permission_denied';
    end if;
  end if;
  return new;
end;
$$;
