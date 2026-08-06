-- Remove o módulo legado de vendas PDV (pos_sales*).
-- Mantém o caixa (pos_cash_sessions / pos_cash_movements) usado pelo PDV atual.
-- Movimentos de estoque com source = 'pdv_sale' permanecem válidos (histórico).

drop policy if exists pos_sale_payments_staff_all on public.pos_sale_payments;
drop policy if exists pos_sale_items_staff_all on public.pos_sale_items;
drop policy if exists pos_sales_staff_all on public.pos_sales;

drop table if exists public.pos_sale_payments cascade;
drop table if exists public.pos_sale_items cascade;
drop table if exists public.pos_sales cascade;
