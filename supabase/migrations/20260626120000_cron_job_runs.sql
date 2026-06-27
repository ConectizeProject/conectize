-- Idempotência de jobs agendados (ex.: broadcast WhatsApp diário).
create table if not exists public.cron_job_runs (
  job_key text not null,
  run_day date not null,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  result jsonb not null default '{}',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (job_key, run_day)
);

comment on table public.cron_job_runs is
  'Evita execução duplicada de crons no mesmo dia (America/Sao_Paulo).';

alter table public.cron_job_runs enable row level security;
