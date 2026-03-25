/**
 * Tipos compartilhados entre a página de listagem, OrdemCard e clientes filhos.
 */

export type PortalOrdensCustomerSummary = {
  id: string
  cpf?: string | null
  cnpj?: string | null
  is_company?: boolean
  full_name?: string | null
  company_name?: string | null
  email?: string | null
  mobile_phone?: string | null
}

export type PortalOrdensDeviceModelSummary = {
  id: string
  brand: string | null
  device_type: string | null
  model: string | null
}

/** Linha retornada pela query de `service_orders` (antes de juntar cliente/dispositivo). */
export type PortalServiceOrderListQueryRow = {
  id: string
  display_number: number | null
  status: string
  title: string
  created_at: string
  updated_at: string
  closed_at: string | null
  estimated_ready_at: string | null
  share_token?: string | null
  customer_id: string | null
  device_model_id: string | null
  services?: unknown
  services_total_cents?: number | null
  services_cost_total_cents?: number | null
  payment_methods?: unknown
}

/** Linha exibida na lista / cards (com relações resolvidas no servidor). */
export type PortalOrdensListRow = PortalServiceOrderListQueryRow & {
  customers: PortalOrdensCustomerSummary | null
  device_models: PortalOrdensDeviceModelSummary | null
}
