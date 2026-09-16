export type PdvOfflineSaleStatus = 'pending' | 'syncing' | 'failed' | 'synced'

export type PdvOfflineSalePayload = {
  customer_name: string
  customer_type?: string | null
  customer_document: string | null
  discount_total_cents: number
  surcharge_cents: number
  items: Array<{
    product_id: string
    quantity: number
    unit_price_cents: number
    unit_cost_cents: number
    discount_cents: number
  }>
  payments: Array<{
    payment_method_id: string | null
    payment_method_type: string
    amount_cents: number
    installments: number
    status: 'paid'
  }>
  change_cents: number
}

export type PdvOfflineSale = {
  id: string
  organizationId: string
  createdAt: string
  status: PdvOfflineSaleStatus
  attemptCount: number
  lastError: string | null
  lastAttemptAt: string | null
  syncedOrderId: string | null
  syncedOrderNumber: number | null
  payload: PdvOfflineSalePayload
  summary: {
    itemCount: number
    totalCents: number
    customerName: string
  }
}

export type PdvOfflineCatalogSnapshot = {
  organizationId: string
  updatedAt: string
  products: unknown[]
  truncated?: boolean
  schemaVersion?: number
}

export type PdvOfflineCatalogProduct = {
  id: string
  organizationId?: string
  name: string
  sku: string | null
  barcode: string | null
  sale_price_cents: number | null
  cost_price_cents?: number | null
  image_url: string | null
  stock: number
  kind?: 'product' | 'service'
}

/** Alias canônico do produto de catálogo (UX + offline). */
export type CatalogProduct = Omit<PdvOfflineCatalogProduct, 'organizationId'>


export type PdvOfflineCatalogMeta = {
  organizationId: string
  updatedAt: string
  truncated?: boolean
  schemaVersion?: number
  productCount?: number
}

export type PdvOfflinePaymentMethodsSnapshot = {
  organizationId: string
  updatedAt: string
  paymentMethods: unknown[]
  schemaVersion?: number
}
