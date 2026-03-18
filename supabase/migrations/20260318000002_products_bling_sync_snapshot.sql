alter table public.products
  add column if not exists bling_sync_snapshot jsonb;
