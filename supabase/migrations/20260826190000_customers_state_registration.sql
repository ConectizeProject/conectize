-- IE do destinatário (NF-e). Pessoa física fica sem IE; PJ informa IE ou isenção.
alter table public.customers
  add column if not exists state_registration text null;

alter table public.customers
  add column if not exists state_registration_exempt boolean not null default false;
