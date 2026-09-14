-- Inclui platform_admin em is_staff_or_admin / is_admin para RLS
-- (histórico de edições da OS e demais policies staff/admin).

create or replace function public.is_admin ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'platform_admin')
  );
$$;

create or replace function public.is_staff_or_admin ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('staff', 'admin', 'platform_admin')
  );
$$;
