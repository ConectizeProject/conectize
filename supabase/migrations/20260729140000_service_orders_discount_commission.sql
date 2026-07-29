-- Desconto e comissão na ordem de serviço (card Formas de pagamento)
alter table public.service_orders
  add column if not exists discount_cents integer not null default 0,
  add column if not exists discount_mode text not null default 'fixed',
  add column if not exists discount_percent numeric(8, 4) null,
  add column if not exists commission_user_id uuid null references public.users (id) on delete set null,
  add column if not exists commission_kind text null,
  add column if not exists commission_fixed_cents integer null,
  add column if not exists commission_percent numeric(8, 4) null;

alter table public.service_orders
  drop constraint if exists service_orders_discount_mode_check;

alter table public.service_orders
  add constraint service_orders_discount_mode_check
    check (discount_mode in ('fixed', 'percent'));

alter table public.service_orders
  drop constraint if exists service_orders_commission_kind_check;

alter table public.service_orders
  add constraint service_orders_commission_kind_check
    check (commission_kind is null or commission_kind in ('fixed', 'percent'));

alter table public.service_orders
  drop constraint if exists service_orders_discount_cents_check;

alter table public.service_orders
  add constraint service_orders_discount_cents_check
    check (discount_cents >= 0);

create index if not exists service_orders_commission_user_id_idx
  on public.service_orders (commission_user_id)
  where commission_user_id is not null;
