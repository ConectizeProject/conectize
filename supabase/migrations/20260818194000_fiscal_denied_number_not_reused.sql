-- NFC-e denegada consome o número na SEFAZ. O mesmo pedido pode emitir outro
-- documento com o próximo número; a denegada permanece no histórico.

drop index if exists public.fiscal_documents_sales_order_nfce_uniq;

create unique index fiscal_documents_sales_order_nfce_uniq
  on public.fiscal_documents (organization_id, sales_order_id)
  where model = '65'
    and sales_order_id is not null
    and status not in ('canceled', 'denied');
