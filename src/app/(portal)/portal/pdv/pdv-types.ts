export type CatalogProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  sale_price_cents: number | null
  cost_price_cents?: number | null
  image_url: string | null
  stock: number
}

export type PdvCustomerMatch = {
  id: string
  label: string
  document: string
  isCompany: boolean
  raw: {
    id: string
    is_company?: boolean | null
    full_name?: string | null
    company_name?: string | null
    trade_name?: string | null
    cpf?: string | null
    cnpj?: string | null
  }
}

export type CartItem = {
  lineId: string
  productId: string
  name: string
  quantity: number
  unitPriceCents: number
  unitCostCents: number
  discountCents: number
}

export type PaymentLine = {
  payment_method_id?: string | null
  payment_method_type: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'outro'
  amountMasked: string
  installments: number
}

export type CreditInstallmentFee = {
  installments: number
  fee_percent: number
}

export type PaymentMethod = {
  id: string
  description: string
  type: 'dinheiro' | 'pix_direto' | 'pix_maquina' | 'credito' | 'debito'
  credit_installment_fees?: CreditInstallmentFee[] | null
}

export type OrderSummary = {
  id: string
  order_number: number
  status: 'in_progress' | 'paid' | 'canceled'
  customer_name: string | null
  total_cents: number
  created_at: string
}

export type PdvClientProps = {
  sellerName: string
  organizationId?: string | null
}
