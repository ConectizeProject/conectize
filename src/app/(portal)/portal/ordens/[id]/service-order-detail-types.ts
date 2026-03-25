/**
 * Forma da ordem carregada em [id]/page.tsx (select em `service_orders` + joins).
 * Usado por OrdemDetalhePageContent em vez de Record genérico.
 */
export type ServiceOrderDetail = {
  id: string
  display_number: number | null
  status: string
  title: string
  imei: string | null
  color: string | null
  is_warranty: boolean | null
  estimated_ready_at: string | null
  passcode_type: string | null
  passcode_text: string | null
  passcode_pattern: string | null
  payment_methods: unknown
  /** Legado (antes de payment_methods JSON) */
  payment_method_id?: string | null
  installments?: number | null
  customer_description: string | null
  receiving_notes: string | null
  warranty_template_id: string | null
  warranty_text: string | null
  device_model_id: string | null
  brand: string | null
  model: string | null
  services: unknown
  services_total_cents: number | null
  services_cost_total_cents: number | null
  created_at: string
  updated_at: string
  closed_at: string | null
  share_token: string | null
  seller_user_id: string | null
  device_entry_checks: unknown
  /** Join Supabase (objeto ou array) — também acessível via helpers. */
  customers?: unknown
  device_models?: unknown
}
