-- Fix: is_staff_or_admin e is_admin com SECURITY DEFINER
-- Garante que as funções consigam ler public.users mesmo com RLS ativo,
-- evitando que staff deixe de ver todas as ordens por causa de restrição na leitura de users.
--
-- Execute no SQL Editor do Supabase.

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
      and u.role = 'admin'
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
      and u.role in ('staff', 'admin')
  );
$$;
