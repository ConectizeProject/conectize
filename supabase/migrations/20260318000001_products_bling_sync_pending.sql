alter table public.products
  add column if not exists bling_sync_pending boolean not null default false;

create index if not exists products_bling_sync_pending_idx
  on public.products (bling_sync_pending);
