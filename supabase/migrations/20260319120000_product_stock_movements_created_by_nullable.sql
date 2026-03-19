-- Movimentos vindos de webhook podem não ter usuário portal associado (service role).
alter table if exists public.product_stock_movements
  alter column created_by drop not null;
