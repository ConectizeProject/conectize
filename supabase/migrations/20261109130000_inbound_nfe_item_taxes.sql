alter table public.inbound_nfe_documents
  add column if not exists operation_nature text;

update public.inbound_nfe_documents
set operation_nature = case fiscal_purpose
  when 'fixed_asset' then 'Compra de bem para o ativo imobilizado'
  when 'use_consumption' then 'Compra de material para uso ou consumo'
  else 'Compra de mercadoria para comercialização'
end
where operation_nature is null;

alter table public.inbound_nfe_documents
  alter column operation_nature set default 'Compra de mercadoria para comercialização',
  alter column operation_nature set not null;

alter table public.inbound_nfe_items
  add column if not exists cfop text,
  add column if not exists fiscal_origin smallint,
  add column if not exists icms_csosn text,
  add column if not exists icms_cst text,
  add column if not exists icms_base_cents bigint not null default 0,
  add column if not exists icms_rate numeric(7, 4) not null default 0,
  add column if not exists icms_value_cents bigint not null default 0,
  add column if not exists pis_cst text,
  add column if not exists pis_base_cents bigint not null default 0,
  add column if not exists pis_rate numeric(7, 4) not null default 0,
  add column if not exists pis_value_cents bigint not null default 0,
  add column if not exists cofins_cst text,
  add column if not exists cofins_base_cents bigint not null default 0,
  add column if not exists cofins_rate numeric(7, 4) not null default 0,
  add column if not exists cofins_value_cents bigint not null default 0,
  add column if not exists ipi_cst text,
  add column if not exists ipi_base_cents bigint not null default 0,
  add column if not exists ipi_rate numeric(7, 4) not null default 0,
  add column if not exists ipi_value_cents bigint not null default 0;

alter table public.inbound_nfe_items
  drop constraint if exists inbound_nfe_items_fiscal_origin_check;

alter table public.inbound_nfe_items
  add constraint inbound_nfe_items_fiscal_origin_check
  check (fiscal_origin is null or fiscal_origin between 0 and 8);

alter table public.inbound_nfe_items
  drop constraint if exists inbound_nfe_items_cfop_check;

alter table public.inbound_nfe_items
  add constraint inbound_nfe_items_cfop_check
  check (cfop is null or cfop ~ '^[1256][0-9]{3}$');

comment on column public.inbound_nfe_items.cfop is
  'CFOP da entrada, editável por item.';

comment on column public.inbound_nfe_items.fiscal_origin is
  'Origem fiscal da mercadoria conforme tabela da NF-e, de 0 a 8.';
