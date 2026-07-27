import type { SupabaseClient } from '@supabase/supabase-js'
import { formatCentsBr } from '@/lib/utils/format-money'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

function parseServicesArrayFromStored (raw: string): unknown[] | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)) {
      return (parsed as { items: unknown[] }).items
    }
  } catch {
    return null
  }
  return null
}

function formatOneServiceLineItem (item: unknown, index: number): string {
  if (!item || typeof item !== 'object') {
    return `Item ${index}: (dado inválido)`
  }
  const row = item as Record<string, unknown>
  const desc = String(row.description ?? '').trim() || '(sem descrição)'
  const isService = row.kind === 'service'

  const qty = row.quantity != null ? Number(row.quantity) : 1

  const valueCents = row.valueCents != null ? Number(row.valueCents) : NaN
  const costCents = row.costCents != null ? Number(row.costCents) : NaN
  const unitValueCents = row.unitValueCents != null ? Number(row.unitValueCents) : NaN
  const unitCostCents = row.unitCostCents != null ? Number(row.unitCostCents) : NaN

  const valueQty = isService ? 1 : qty
  const totalValue = Number.isFinite(valueCents)
    ? Math.round(valueCents)
    : Number.isFinite(unitValueCents) && Number.isFinite(valueQty)
      ? Math.round(unitValueCents * valueQty)
      : NaN

  const totalCost = Number.isFinite(costCents)
    ? Math.round(costCents)
    : Number.isFinite(unitCostCents) && Number.isFinite(valueQty)
      ? Math.round(unitCostCents * valueQty)
      : NaN

  const lines = [
    desc,
    `Valor: ${Number.isFinite(totalValue) ? formatCentsBr(totalValue) : '—'}`,
    `Custo: ${Number.isFinite(totalCost) ? formatCentsBr(totalCost) : '—'}`,
  ]
  if (!isService) {
    lines.push(`Quantidade: ${Number.isFinite(qty) ? String(qty) : '—'}`)
  }
  return lines.join('\n')
}

/**
 * Texto legível para histórico de edições (campo `services`).
 */
export function formatOrderServicesForHistoryDisplay (raw: string | null | undefined): string {
  const v = raw ?? ''
  const arr = parseServicesArrayFromStored(v)
  if (arr === null) {
    return v.trim() ? v : '(vazio)'
  }
  if (arr.length === 0) return '(nenhum item)'
  return arr.map((item, i) => formatOneServiceLineItem(item, i + 1)).join('\n\n────────\n\n')
}

function normalizeIso (value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value).trim()
  return d.toISOString()
}

function parseOrderPaymentMethodsForCompare (order: {
  payment_methods?: unknown
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

/**
 * JSON estável para comparação: mesma estrutura com ordem de chaves diferente → mesma string.
 */
function sortObjectKeysDeep (value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(sortObjectKeysDeep)
  }
  const proto = Object.getPrototypeOf(value)
  if (proto !== null && proto !== Object.prototype) {
    return value
  }
  const o = value as Record<string, unknown>
  const sortedKeys = Object.keys(o).sort()
  const out: Record<string, unknown> = {}
  for (const k of sortedKeys) {
    out[k] = sortObjectKeysDeep(o[k])
  }
  return out
}

function stableJsonStringifyForCompare (value: unknown): string {
  try {
    return JSON.stringify(sortObjectKeysDeep(value))
  } catch {
    return JSON.stringify(value)
  }
}

/** Extrai lista de itens (array direto, `{ items }` ou JSON string) — mesmo universo que o formulário / DB. */
function parseServicesItemsFromUnknown (value: unknown): unknown[] {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    const t = value.trim()
    if (!t) return []
    try {
      const parsed = JSON.parse(t)
      if (Array.isArray(parsed)) return parsed
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)) {
        return (parsed as { items: unknown[] }).items
      }
    } catch {
      return []
    }
    return []
  }
  if (typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: unknown[] }).items
  }
  return []
}

type NormalizedServiceLineForCompare = {
  kind: 'service' | 'product'
  description: string
  quantity: number
  unitValueCents: number
  unitCostCents: number
  valueCents: number
  costCents: number
  sourceProductId: string | null
  noCost: boolean
}

/**
 * Mesma regra de negócio que `parseServicesJson` na página da OS (centavos, qty, kind).
 * Assim comparamos sem falsos positivos por ordem de chaves JSON ou formatos equivalentes.
 */
function normalizeServiceLineForCompare (item: unknown): NormalizedServiceLineForCompare | null {
  if (!item || typeof item !== 'object') return null
  const i = item as Record<string, unknown>
  const kind: 'service' | 'product' = i.kind === 'product' ? 'product' : 'service'
  const description = String(i?.description ?? '').trim().slice(0, 240)
  const quantityRaw =
    kind === 'product'
      ? Number.parseInt(String(i?.quantity ?? '1'), 10)
      : 1
  const quantity =
    Number.isFinite(quantityRaw) && quantityRaw > 0
      ? Math.min(9999, Math.max(1, quantityRaw))
      : 1
  const noCost = i.noCost === true
  const unitValueCentsRaw = i.unitValueCents ?? i.valueCents ?? 0
  const unitCostCentsRaw = noCost ? 0 : (i.unitCostCents ?? i.costCents ?? 0)
  const unitValueCents = Math.max(0, Math.round(Number(unitValueCentsRaw ?? 0) || 0))
  const unitCostCents = Math.max(0, Math.round(Number(unitCostCentsRaw ?? 0) || 0))
  const valueCents = Math.round(unitValueCents * quantity)
  const costCents = Math.round(unitCostCents * quantity)
  const sourceProductId = parseOptionalUuid(i.sourceProductId)
  const line: NormalizedServiceLineForCompare = {
    kind,
    description,
    quantity,
    unitValueCents,
    unitCostCents,
    valueCents,
    costCents,
    sourceProductId,
    noCost,
  }
  if (!line.description && line.valueCents <= 0 && line.costCents <= 0) return null
  return line
}

function serviceLineCompareKey (a: NormalizedServiceLineForCompare): string {
  return [
    a.kind,
    a.sourceProductId ?? '',
    a.description,
    String(a.quantity),
    String(a.valueCents),
    String(a.costCents),
    String(a.unitValueCents),
    String(a.unitCostCents),
    a.noCost ? '1' : '0',
  ].join('\u0001')
}

function serializeServicesForCompare (value: unknown): string {
  const rawItems = parseServicesItemsFromUnknown(value)
  const normalized = rawItems
    .map(normalizeServiceLineForCompare)
    .filter((x): x is NormalizedServiceLineForCompare => x != null)
  normalized.sort((a, b) => serviceLineCompareKey(a).localeCompare(serviceLineCompareKey(b)))
  return stableJsonStringifyForCompare(normalized)
}

function serializeScalar (key: string, value: unknown): string {
  if (value === null || value === undefined) return ''
  if (key === 'status') return String(value).trim()
  if (key === 'is_warranty') return value === true || value === 'true' ? 'true' : 'false'
  if (key === 'estimated_ready_at' || key === 'closed_at') return normalizeIso(value)
  if (key === 'payment_methods') return sortPaymentMethodsJson(value)
  if (key === 'warranty_template_id') {
    const id = parseOptionalUuid(value)
    return id ?? ''
  }
  if (key === 'services') return serializeServicesForCompare(value)
  if (key === 'device_entry_checks' || key === 'device_exit_checks') {
    if (value === null || value === undefined) return ''
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      return stableJsonStringifyForCompare(parsed)
    } catch {
      return typeof value === 'string' ? value : JSON.stringify(value)
    }
  }
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string') {
    const t = ['title', 'imei', 'color', 'device_location', 'customer_description', 'receiving_notes', 'warranty_text', 'passcode_text', 'passcode_pattern'].includes(key)
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

export type WarrantyTemplateHistorySnapshot = {
  id: string | null
  label: string
}

function warrantyTemplateHistoryPayload (id: string | null, label: string): string {
  return JSON.stringify({ id, label } satisfies WarrantyTemplateHistorySnapshot)
}

/**
 * Grava no histórico JSON `{ id, label }` para o campo warranty_template_id (nome em `warranty_templates.name`).
 */
export async function enrichWarrantyTemplateHistoryValues (
  supabase: SupabaseClient,
  rows: OrderEditDiffRow[],
): Promise<OrderEditDiffRow[]> {
  const warrantyRows = rows.filter((r) => r.field_key === 'warranty_template_id')
  if (warrantyRows.length === 0) return rows

  const ids = new Set<string>()
  for (const r of warrantyRows) {
    const o = parseOptionalUuid(r.old_value)
    const n = parseOptionalUuid(r.new_value)
    if (o) ids.add(o)
    if (n) ids.add(n)
  }

  const map = new Map<string, string>()
  if (ids.size > 0) {
    const { data: templates } = await supabase
      .from('warranty_templates')
      .select('id, name')
      .in('id', [...ids])

    for (const t of templates ?? []) {
      const row = t as { id: string; name: string | null }
      const name = String(row.name ?? '').trim()
      map.set(row.id, name || '(sem nome)')
    }
  }

  const labelFor = (raw: string): { id: string | null; label: string } => {
    const id = parseOptionalUuid(raw)
    if (!id) return { id: null, label: '(nenhum)' }
    const name = map.get(id)
    if (name !== undefined) return { id, label: name }
    return { id, label: '(modelo não encontrado)' }
  }

  return rows.map((r) => {
    if (r.field_key !== 'warranty_template_id') return r
    const oldPart = labelFor(r.old_value)
    const newPart = labelFor(r.new_value)
    return {
      ...r,
      old_value: warrantyTemplateHistoryPayload(oldPart.id, oldPart.label),
      new_value: warrantyTemplateHistoryPayload(newPart.id, newPart.label),
    }
  })
}

/**
 * Exibe só o nome do modelo no histórico (valor gravado como JSON `{ id, label }`).
 */
export function formatWarrantyTemplateHistoryDisplay (raw: string | null | undefined): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return '(vazio)'
  try {
    const o = JSON.parse(trimmed) as { label?: unknown }
    if (o && typeof o === 'object' && 'label' in o) {
      const label = String(o.label ?? '').trim()
      return label || '(vazio)'
    }
  } catch {
    // legado: só UUID
  }
  return trimmed
}

export const ORDER_EDIT_FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  status: 'Status',
  imei: 'IMEI / serial',
  color: 'Cor',
  device_location: 'Localização do aparelho',
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
  device_exit_checks: 'Checklist de saída',
  seller_user_id: 'Vendedor',
  closed_at: 'Data de fechamento',
}
