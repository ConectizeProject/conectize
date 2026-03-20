-- Marca quando o custo foi alterado pelo cadastro no portal (modal/página).
-- Listagem: compara com a data da última entrada para decidir se mostra custo do estoque ou do produto.
alter table public.products
  add column if not exists cost_price_manual_edited_at timestamptz null;

comment on column public.products.cost_price_manual_edited_at is
  'Preenchido ao salvar alteração de custo pelo portal; listagem prioriza última entrada de estoque se for posterior.';
