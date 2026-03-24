import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

function normalizeIso (value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value).trim()
  return d.toISOString()
}

function parseOrderPaymentMethodsForCompare (order: {
  payment_methods?: unknown
  payment_method_id?: string | null
  installments?: number | null
}): Array<{ payment_method_id: string; installments?: number; value_cents?: number | null }> {
  let pm = order?.payment_methods
  if (typeof pm === 'string') {
    try {
      pm = JSON.parse(pm)
    } catch {
      pm = null
    }
  }
  if (Array.isArray(pm) && pm.length > 0) {
    return pm
      .map((e: unknown) => {
        const row = e as Record<string, unknown>
        const id = parseOptionalUuid(row?.payment_method_id)
        if (!id) return null
        return {
          payment_method_id: id,
          installments: row.installments != null ? Number(row.installments) : undefined,
          value_cents: row.value_cents != null ? Math.max(0, Number(row.value_cents) || 0) : null,
        }
      })
      .filter(Boolean) as Array<{ payment_method_id: string; installments?: number; value_cents?: number | null }>
  }
  const legacyId = parseOptionalUuid(order?.payment_method_id)
  if (legacyId) {
    return [{ payment_method_id: legacyId, installments: order?.installments ?? 1, value_cents: null }]
  }
  return []
}

function sortPaymentMethodsJson (pm: unknown): string {
  let normalized: Array<{ payment_method_id: string; installments?: number; value_cents?: number | null }>
  if (Array.isArray(pm)) {
    normalized = pm
      .map((e: unknown) => {
        const row = e as Record<string, unknown>
        const id = parseOptionalUuid(row?.payment_method_id)
        if (!id) return null
        return {
          payment_method_id: id,
          installments: row.installments != null ? Number(row.installments) : undefined,
          value_cents: row.value_cents != null ? Math.max(0, Number(row.value_cents) || 0) : null,
        }
      })
      .filter(Boolean) as Array<{ payment_method_id: string; installments?: number; value_cents?: number | null }>
  } else {
    normalized = parseOrderPaymentMethodsForCompare({ payment_methods: pm })
  }
  const sorted = [...normalized].sort((a, b) => a.payment_method_id.localeCompare(b.payment_method_id))
  return JSON.stringify(sorted)
}

function serializeServicesForCompare (value: unknown): string {
  if (value === null || value === undefined) return '[]'
  if (Array.isArray(value)) return JSON.stringify(value)
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (Array.isArray(parsed)) return JSON.stringify(parsed)
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)) {
      return JSON.stringify((parsed as { items: unknown[] }).items)
    }
  } catch {
    return String(value)
  }
  return JSON.stringify(value)
}

function serializeScalar (key: string, value: unknown): string {
  if (value === null || value === undefined) return ''
  if (key === 'status') return String(value).trim()
  if (key === 'is_warranty') return value === true || value === 'true' ? 'true' : 'false'
  if (key === 'estimated_ready_at' || key === 'closed_at') return normalizeIso(value)
  if (key === 'payment_methods') return sortPaymentMethodsJson(value)
  if (key === 'services') return serializeServicesForCompare(value)
  if (key === 'device_entry_checks') {
    if (value === null || value === undefined) return ''
    return typeof value === 'string' ? value : JSON.stringify(value)
  }
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string') {
    const t = ['title', 'imei', 'color', 'customer_description', 'receiving_notes', 'warranty_text', 'brand', 'model', 'passcode_text', 'passcode_pattern'].includes(key)
    return t ? value.trim() : value
  }
  return String(value)
}

export type OrderEditDiffRow = {
  field_key: string
  old_value: string
  new_value: string
}

/**
 * Compara o estado atual da OS com o payload de update e retorna uma linha por campo alterado.
 */
export function buildOrderEditDiff (
  existing: Record<string, unknown> | null | undefined,
  updatePayload: Record<string, unknown> | undefined,
): OrderEditDiffRow[] {
  if (!existing || !updatePayload) return []
  const rows: OrderEditDiffRow[] = []
  for (const key of Object.keys(updatePayload)) {
    const oldRaw = existing[key]
    const newRaw = updatePayload[key]
    const oldS = serializeScalar(key, oldRaw)
    const newS = serializeScalar(key, newRaw)
    if (oldS !== newS) {
      rows.push({
        field_key: key,
        old_value: oldS,
        new_value: newS,
      })
    }
  }
  return rows
}

export const ORDER_EDIT_FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  status: 'Status',
  imei: 'IMEI / serial',
  color: 'Cor',
  is_warranty: 'Serviço em garantia',
  estimated_ready_at: 'Previsão',
  passcode_type: 'Tipo de senha',
  passcode_text: 'Senha (texto)',
  passcode_pattern: 'Senha (padrão)',
  payment_methods: 'Formas de pagamento',
  customer_description: 'Descrição (cliente)',
  receiving_notes: 'Observações do recebimento',
  warranty_template_id: 'Modelo de garantia',
  warranty_text: 'Texto da garantia',
  device_model_id: 'Modelo do aparelho',
  brand: 'Marca',
  model: 'Modelo',
  services: 'Serviços e itens',
  services_total_cents: 'Total serviços (R$)',
  services_cost_total_cents: 'Custo total (R$)',
  device_entry_checks: 'Checklist de entrada',
  seller_user_id: 'Vendedor',
  closed_at: 'Data de fechamento',
}
