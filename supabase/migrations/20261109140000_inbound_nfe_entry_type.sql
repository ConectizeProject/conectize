alter table public.inbound_nfe_documents
  add column if not exists entry_type text,
  add column if not exists import_declaration jsonb,
  add column if not exists freight_cents bigint not null default 0,
  add column if not exists insurance_cents bigint not null default 0,
  add column if not exists other_expenses_cents bigint not null default 0,
  add column if not exists discount_cents bigint not null default 0,
  add column if not exists transport_mode text not null default 'none',
  add column if not exists complementary_information text,
  add column if not exists fiscal_information text;

update public.inbound_nfe_documents
set entry_type = case
  when source_mode = 'xml' then 'xml_import'
  else 'own_issuance'
end
where entry_type is null;

alter table public.inbound_nfe_documents
  alter column entry_type set default 'own_issuance',
  alter column entry_type set not null;

alter table public.inbound_nfe_documents
  drop constraint if exists inbound_nfe_documents_entry_type_check;

alter table public.inbound_nfe_documents
  add constraint inbound_nfe_documents_entry_type_check
  check (entry_type in ('own_issuance', 'third_party', 'import', 'xml_import'));

alter table public.inbound_nfe_documents
  drop constraint if exists inbound_nfe_documents_transport_mode_check;

alter table public.inbound_nfe_documents
  add constraint inbound_nfe_documents_transport_mode_check
  check (transport_mode in ('none', 'buyer', 'seller', 'carrier'));
