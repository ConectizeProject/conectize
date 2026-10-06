-- Fecha dois gadgets de tenant admin:
-- 1) organizations_update_org_admin permite PATCH de is_host / created_at.
--    host_organization_id() escolhe a org com is_host=true mais antiga, então
--    um tenant podia se promover a matriz e herdar catálogo / claim de cliente.
-- 2) trg_clear_parent_product_stock (SECURITY DEFINER) apagava
--    product_stock_movements de qualquer produto com o mesmo bling_id, sem
--    filtrar organization_id. Um filho com parent_bling_id da vítima zerava
--    o estoque dela.
--
-- service_role / SQL Editor (auth.uid() nulo) continuam podendo ajustar
-- identidade de host. JWT autenticado, inclusive platform_admin, não.

create or replace function public.prevent_host_identity_tampering ()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.is_host is distinct from old.is_host
     or new.created_at is distinct from old.created_at then
    raise exception 'permission_denied';
  end if;

  return new;
end;
$$;

drop trigger if exists organizations_prevent_host_identity_tampering
  on public.organizations;

create trigger organizations_prevent_host_identity_tampering
before update on public.organizations
for each row execute function public.prevent_host_identity_tampering();

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
            and c.organization_id = p.organization_id
        )
        or (
          p.bling_id is not null
          and btrim(p.bling_id) <> ''
          and exists (
            select 1
            from public.products c
            where c.parent_bling_id = p.bling_id
              and c.organization_id = p.organization_id
          )
        )
      )
  );
$$;

comment on function public.product_has_variation_children (uuid) is
  'True se o produto tem pelo menos uma variação (filho) na mesma organização.';

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
    parent_ids := array(
      select p.id
      from public.products p
      where p.id = new.parent_product_id
        and p.organization_id = new.organization_id
    );
  end if;

  if new.parent_bling_id is not null and btrim(new.parent_bling_id) <> '' then
    parent_ids := parent_ids || array(
      select p.id
      from public.products p
      where p.bling_id = new.parent_bling_id
        and p.parent_bling_id is null
        and p.parent_product_id is null
        and p.organization_id = new.organization_id
    );
  end if;

  if parent_ids is not null and array_length(parent_ids, 1) is not null then
    delete from public.product_stock_movements
    where product_id = any (parent_ids);
  end if;

  return new;
end;
$$;
