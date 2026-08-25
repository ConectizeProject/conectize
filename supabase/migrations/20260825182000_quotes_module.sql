-- Módulo próprio de orçamentos (separado de service_orders)

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  display_number integer,
  title text not null default 'Orçamento',
  status text not null default 'rascunho',
  items jsonb not null default '[]'::jsonb,
  items_total_cents integer not null default 0 check (items_total_cents >= 0),
  items_cost_total_cents integer not null default 0 check (items_cost_total_cents >= 0),
  valid_until date not null default (current_date + 7),
  share_token text unique,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  service_order_id uuid references public.service_orders (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotes_status_check check (
    status in ('rascunho', 'enviado', 'aprovado', 'recusado', 'expirado', 'convertido', 'cancelado')
  )
);

create unique index if not exists quotes_org_display_number_key
  on public.quotes (organization_id, display_number);

create index if not exists quotes_organization_id_idx
  on public.quotes (organization_id);

create index if not exists quotes_status_idx
  on public.quotes (organization_id, status);

create index if not exists quotes_customer_id_idx
  on public.quotes (organization_id, customer_id);

create index if not exists quotes_valid_until_idx
  on public.quotes (organization_id, valid_until);

create or replace function public.set_quote_display_number ()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    raise exception 'organization_id is required for quotes';
  end if;
  if new.display_number is null then
    perform pg_advisory_xact_lock(hashtextextended('quotes:' || new.organization_id::text, 0));
    select coalesce(max(q.display_number), -1) + 1 into new.display_number
    from public.quotes q
    where q.organization_id = new.organization_id;
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_set_display_number on public.quotes;
create trigger quotes_set_display_number
  before insert on public.quotes
  for each row execute function public.set_quote_display_number();

create or replace function public.quotes_set_share_token ()
returns trigger
language plpgsql
as $$
begin
  if new.share_token is null then
    new.share_token := gen_random_uuid()::text;
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_set_share_token_trigger on public.quotes;
create trigger quotes_set_share_token_trigger
  before insert on public.quotes
  for each row execute function public.quotes_set_share_token();

create or replace function public.quotes_touch_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists quotes_touch_updated_at_trigger on public.quotes;
create trigger quotes_touch_updated_at_trigger
  before update on public.quotes
  for each row execute function public.quotes_touch_updated_at();

alter table public.quotes enable row level security;

drop policy if exists quotes_staff_admin_all on public.quotes;
create policy quotes_staff_admin_all
  on public.quotes for all
  to authenticated
  using (
    public.is_staff_or_admin()
    and quotes.organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff_or_admin()
    and quotes.organization_id = public.current_organization_id()
  );

grant select, insert, update, delete on public.quotes to postgres, service_role, authenticated;
