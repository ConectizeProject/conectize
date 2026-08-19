import type { FiscalDocumentStatus } from '@/lib/fiscal/document-status'

export type FiscalDocumentListRow = {
  id: string
  model: '55' | '65'
  environment: 'homologacao' | 'producao'
  series: number
  number: number
  status: FiscalDocumentStatus
  access_key: string | null
  protocol: string | null
  sefaz_status_code: string | null
  sefaz_status_message: string | null
  sales_order_id: string | null
  order_number: number | null
  customer_name: string | null
  total_cents: number | null
  created_at: string
  authorized_at: string | null
}

export type FiscalDocumentItemRow = {
  id: string
  product_id: string
  name: string
  sku: string | null
  quantity: number
  unit_price_cents: number
  discount_cents: number
  subtotal_cents: number
  ncm: string | null
  cest: string | null
  fiscal_origin: number | null
  fci: string | null
  fiscal_unit: string | null
}

export type FiscalDocumentDetail = {
  id: string
  model: '55' | '65'
  environment: 'homologacao' | 'producao'
  series: number
  number: number
  status: FiscalDocumentStatus
  access_key: string | null
  protocol: string | null
  qr_code_url: string | null
  sefaz_status_code: string | null
  sefaz_status_message: string | null
  sales_order_id: string | null
  authorized_at: string | null
  canceled_at: string | null
  created_at: string
  order: {
    id: string
    order_number: number
    status: string
    customer_name: string | null
    customer_type: string | null
    customer_document: string | null
    total_cents: number
  } | null
  items: FiscalDocumentItemRow[]
}
