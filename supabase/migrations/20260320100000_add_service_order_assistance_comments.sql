-- Comentários (chat) sobre a assistência por OS

create table if not exists public.service_order_assistance_comments (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  author_user_id uuid references public.users(id) on delete set null,
  author_display_name text not null default '',
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists service_order_assistance_comments_order_id_created_at_idx
  on public.service_order_assistance_comments(service_order_id, created_at);

alter table public.service_order_assistance_comments enable row level security;

create policy "service_order_assistance_comments_staff_admin_select"
on public.service_order_assistance_comments for select
to authenticated
using (public.is_staff_or_admin());

create policy "service_order_assistance_comments_staff_admin_insert"
on public.service_order_assistance_comments for insert
to authenticated
with check (public.is_staff_or_admin());

