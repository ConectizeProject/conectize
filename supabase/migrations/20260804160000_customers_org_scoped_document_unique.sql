-- Unicidade de CPF/CNPJ por organização (multi-tenant).
-- Antes: índices globais em customers(cpf) / customers(cnpj) bloqueavam
-- o mesmo documento em lojas diferentes e a API respondia 500 (db_error).

drop index if exists public.customers_cpf_unique;
drop index if exists public.customers_cnpj_unique;

create unique index if not exists customers_org_cpf_unique
  on public.customers (organization_id, cpf)
  where cpf is not null;

create unique index if not exists customers_org_cnpj_unique
  on public.customers (organization_id, cnpj)
  where cnpj is not null;
