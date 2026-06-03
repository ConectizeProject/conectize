-- Exclusão lógica de carteiras (contas): mantém financial_transactions e histórico.

alter table public.contas
  add column if not exists deleted_at timestamptz;

comment on column public.contas.deleted_at is
  'Preenchido ao excluir a carteira; transações permanecem vinculadas por conta_id.';

create index if not exists contas_active_organization_idx
  on public.contas (organization_id)
  where deleted_at is null;
