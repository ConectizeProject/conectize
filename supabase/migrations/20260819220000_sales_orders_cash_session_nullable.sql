-- Pedidos criados em Vendas (fora do PDV) não precisam de sessão de caixa.
alter table public.sales_orders
  alter column cash_session_id drop not null;
