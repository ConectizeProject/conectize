-- Tipo de estoque (aba Seminovos / Lacrados) e comissão na venda
alter table public.resale_devices
  add column if not exists stock_type text not null default 'seminovo';

alter table public.resale_devices
  drop constraint if exists resale_devices_stock_type_check;

alter table public.resale_devices
  add constraint resale_devices_stock_type_check
  check (stock_type in ('seminovo', 'lacrado'));

alter table public.resale_devices
  add column if not exists sale_commission_user_id uuid null references public.users(id) on delete set null;

create index if not exists resale_devices_stock_type_idx on public.resale_devices(stock_type);
