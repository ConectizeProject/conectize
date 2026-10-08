-- Agendamento online da landing de bateria vira OS.

alter table public.service_orders
  add column if not exists origin text not null default 'portal',
  add column if not exists appointment_starts_at timestamptz null,
  add column if not exists appointment_reviewed_at timestamptz null,
  add column if not exists appointment_reviewed_by uuid null references public.users (id) on delete set null,
  add column if not exists appointment_model_label text null;

alter table public.service_orders
  drop constraint if exists service_orders_origin_check;

alter table public.service_orders
  add constraint service_orders_origin_check
    check (origin in ('portal', 'agendamento'));

create unique index if not exists service_orders_appointment_slot_unique
  on public.service_orders (organization_id, appointment_starts_at)
  where origin = 'agendamento'
    and appointment_starts_at is not null
    and status <> 'cancelada';

create index if not exists service_orders_appointment_starts_idx
  on public.service_orders (organization_id, appointment_starts_at)
  where origin = 'agendamento';

create table if not exists public.staff_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null,
  service_order_id uuid null references public.service_orders (id) on delete cascade,
  title text not null,
  body text not null,
  href text null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create index if not exists staff_notifications_user_unread_idx
  on public.staff_notifications (user_id, created_at desc)
  where read_at is null;

alter table public.staff_notifications enable row level security;

drop policy if exists staff_notifications_select_own on public.staff_notifications;
create policy staff_notifications_select_own
  on public.staff_notifications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists staff_notifications_update_own on public.staff_notifications;
create policy staff_notifications_update_own
  on public.staff_notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own
  on public.push_subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own
  on public.push_subscriptions
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own
  on public.push_subscriptions
  for delete
  to authenticated
  using (user_id = auth.uid());
