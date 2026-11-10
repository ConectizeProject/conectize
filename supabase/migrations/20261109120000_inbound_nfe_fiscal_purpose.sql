alter table public.inbound_nfe_documents
  add column if not exists fiscal_purpose text,
  add column if not exists should_move_stock boolean not null default true;

update public.inbound_nfe_documents
set fiscal_purpose = case
  when entry_kind = 'used_devices' then 'resale'
  else 'resale'
end
where fiscal_purpose is null;

alter table public.inbound_nfe_documents
  alter column fiscal_purpose set default 'resale',
  alter column fiscal_purpose set not null;

alter table public.inbound_nfe_documents
  drop constraint if exists inbound_nfe_documents_fiscal_purpose_check;

alter table public.inbound_nfe_documents
  add constraint inbound_nfe_documents_fiscal_purpose_check
  check (fiscal_purpose in ('resale', 'fixed_asset', 'use_consumption'));

comment on column public.inbound_nfe_documents.fiscal_purpose is
  'Finalidade da entrada: revenda, ativo imobilizado ou uso/consumo.';

comment on column public.inbound_nfe_documents.should_move_stock is
  'Define se o lançamento deve gerar movimentação física de estoque.';
