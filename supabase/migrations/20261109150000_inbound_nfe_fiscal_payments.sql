alter table public.inbound_nfe_documents
  add column if not exists fiscal_payments jsonb not null default '[]'::jsonb;

comment on column public.inbound_nfe_documents.fiscal_payments is
  'Formas e valores de pagamento informados no XML da NF-e, sem gerar movimentação financeira automaticamente.';
