-- Relatório de vendas: filtro sold = true + intervalo em sale_date
create index if not exists resale_devices_sold_sale_date_idx
  on public.resale_devices (sale_date)
  where sold = true;
