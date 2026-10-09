create table if not exists public.signup_ip_events (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists signup_ip_events_hash_created_idx
  on public.signup_ip_events (ip_hash, created_at desc);

alter table public.signup_ip_events enable row level security;
