-- Progresso da importação do catálogo Bling: a listagem grava o produto na hora
-- e o detalhe (GTIN, fiscal) pode continuar depois, sem repetir o que já entrou.

alter table public.products
  add column if not exists bling_detail_synced_at timestamptz,
  add column if not exists bling_detail_error text;

create index if not exists products_org_bling_detail_pending_idx
  on public.products (organization_id, created_at)
  where bling_id is not null
    and bling_detail_synced_at is null;

create table if not exists public.bling_catalog_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  status text not null default 'listing'
    constraint bling_catalog_sync_runs_status_check
      check (status in ('listing', 'detailing', 'paused', 'completed', 'error')),
  total_listed integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  detailed_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_detail_count integer not null default 0,
  last_page integer not null default 0,
  census_done boolean not null default false,
  truncated boolean not null default false,
  error_message text,
  started_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create unique index if not exists bling_catalog_sync_runs_one_open_idx
  on public.bling_catalog_sync_runs (organization_id)
  where status in ('listing', 'detailing', 'paused', 'error');

create index if not exists bling_catalog_sync_runs_org_created_idx
  on public.bling_catalog_sync_runs (organization_id, created_at desc);

alter table public.bling_catalog_sync_runs enable row level security;

drop policy if exists bling_catalog_sync_runs_staff_admin_all on public.bling_catalog_sync_runs;
create policy bling_catalog_sync_runs_staff_admin_all
  on public.bling_catalog_sync_runs for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and bling_catalog_sync_runs.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and bling_catalog_sync_runs.organization_id = public.current_organization_id()
  );

grant select, insert, update, delete on public.bling_catalog_sync_runs to postgres, service_role, authenticated;
