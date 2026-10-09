create table if not exists public.appointment_slot_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  starts_at timestamptz not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, starts_at)
);

create index if not exists appointment_slot_blocks_org_starts_idx
  on public.appointment_slot_blocks (organization_id, starts_at);

alter table public.appointment_slot_blocks enable row level security;

create table if not exists public.booking_ip_events (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists booking_ip_events_hash_created_idx
  on public.booking_ip_events (ip_hash, created_at desc);

alter table public.booking_ip_events enable row level security;
