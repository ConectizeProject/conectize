-- Ainda restavam UNIQUE keys globais (customers_cpf_key / customers_cnpj_key),
-- distintas dos índices customers_*_unique já removidos. Elas bloqueavam o mesmo
-- documento entre organizações e faziam o cadastro falhar com already_exists
-- sem o cliente aparecer na listagem da loja atual.
--
-- Constraint UNIQUE deve ser dropada antes do índice subjacente.

alter table public.customers drop constraint if exists customers_cpf_key;
alter table public.customers drop constraint if exists customers_cnpj_key;

drop index if exists public.customers_cpf_key;
drop index if exists public.customers_cnpj_key;
drop index if exists public.customers_cpf_unique;
drop index if exists public.customers_cnpj_unique;

create unique index if not exists customers_org_cpf_unique
  on public.customers (organization_id, cpf)
  where cpf is not null;

create unique index if not exists customers_org_cnpj_unique
  on public.customers (organization_id, cnpj)
  where cnpj is not null;
