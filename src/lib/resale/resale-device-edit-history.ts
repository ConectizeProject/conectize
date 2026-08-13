import type { SupabaseClient } from '@supabase/supabase-js'
import { formatCentsBr } from '@/lib/utils/format-money'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

export type ResaleEditDiffRow = {
  field_key: string
  old_value: string
  new_value: string
}

function normalizeIso (value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value).trim()
  return d.toISOString()
}

function sortObjectKeysDeep (value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortObjectKeysDeep)
  const proto = Object.getPrototypeOf(value)
  if (proto !== null && proto !== Object.prototype) return value
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

function parseSalePaymentMethods (raw: unknown): Array<{
  payment_method_id: string
  installments?: number
  value_cents?: number | null
}> {
  let pm = raw
  if (typeof pm === 'string') {
    try {
      pm = JSON.parse(pm)
    } catch {
      pm = null
    }
  }
  if (!Array.isArray(pm)) return []
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
    .filter(Boolean) as Array<{
    payment_method_id: string
    installments?: number
    value_cents?: number | null
  }>
}

function sortPaymentMethodsJson (pm: unknown): string {
  const normalized = parseSalePaymentMethods(pm)
  const sorted = [...normalized].sort((a, b) =>
    a.payment_method_id.localeCompare(b.payment_method_id),
  )
  return JSON.stringify(sorted)
}

function serializeCosts (value: unknown): string {
  if (value === null || value === undefined) return ''
  let arr: unknown = value
  if (typeof value === 'string') {
    try {
      arr = JSON.parse(value)
    } catch {
      return value.trim()
    }
  }
  if (!Array.isArray(arr)) return stableJsonStringifyForCompare(arr)
  const normalized = arr
    .map((item) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      const description = String(row.description ?? '').trim()
      const valueCents =
        typeof row.value_cents === 'number'
          ? Math.round(row.value_cents)
          : Math.round(Number(row.value_cents ?? row.value ?? 0) || 0)
      return { description, value_cents: valueCents }
    })
    .sort((a, b) =>
      `${a.description}\u0001${a.value_cents}`.localeCompare(`${b.description}\u0001${b.value_cents}`),
    )
  return JSON.stringify(normalized)
}

function serializeScalar (key: string, value: unknown): string {
  if (value === null || value === undefined) return ''
  if (
    key === 'sold'
    || key === 'advertised'
    || key === 'tested'
  ) {
    return value === true || value === 'true' ? 'true' : 'false'
  }
  if (
    key === 'sold_for_cents'
    || key === 'actual_profit_cents'
    || key === 'purchase_value_cents'
    || key === 'wholesale_value_cents'
    || key === 'sale_value_cents'
    || key === 'expected_profit_sale_cents'
    || key === 'expected_profit_wholesale_cents'
  ) {
    if (value === null || value === undefined || value === '') return ''
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? String(Math.round(n)) : ''
  }
  if (key === 'sale_date' || key === 'purchase_date' || key === 'commission_paid_at') {
    const s = String(value).trim()
    if (!s) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    return normalizeIso(value).slice(0, 10) || s
  }
  if (key === 'sale_payment_methods') return sortPaymentMethodsJson(value)
  if (key === 'costs') return serializeCosts(value)
  if (
    key === 'payment_method_id'
    || key === 'sale_commission_user_id'
    || key === 'device_model_id'
  ) {
    return parseOptionalUuid(value) ?? ''
  }
  if (typeof value === 'object') return stableJsonStringifyForCompare(value)
  if (typeof value === 'string') return value.trim()
  return String(value)
}

/**
 * Compara o aparelho atual com o payload de update e retorna uma linha por campo alterado.
 */
export function buildResaleDeviceEditDiff (
  existing: Record<string, unknown> | null | undefined,
  updatePayload: Record<string, unknown> | undefined,
): ResaleEditDiffRow[] {
  if (!existing || !updatePayload) return []
  const rows: ResaleEditDiffRow[] = []
  for (const key of Object.keys(updatePayload)) {
    const oldS = serializeScalar(key, existing[key])
    const newS = serializeScalar(key, updatePayload[key])
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

export function buildResaleCostsEditDiff (
  existingCosts: unknown,
  nextCosts: unknown,
): ResaleEditDiffRow | null {
  const oldS = serializeScalar('costs', existingCosts)
  const newS = serializeScalar('costs', nextCosts)
  if (oldS === newS) return null
  return {
    field_key: 'costs',
    old_value: oldS,
    new_value: newS,
  }
}

type UserHistorySnapshot = {
  id: string | null
  label: string
}

function userHistoryPayload (id: string | null, label: string): string {
  return JSON.stringify({ id, label } satisfies UserHistorySnapshot)
}

/**
 * Grava `{ id, label }` para `sale_commission_user_id` (nome do colaborador).
 */
export async function enrichResaleCommissionUserHistoryValues (
  supabase: SupabaseClient,
  rows: ResaleEditDiffRow[],
): Promise<ResaleEditDiffRow[]> {
  const commissionRows = rows.filter((r) => r.field_key === 'sale_commission_user_id')
  if (commissionRows.length === 0) return rows

  const ids = new Set<string>()
  for (const r of commissionRows) {
    const o = parseOptionalUuid(r.old_value)
    const n = parseOptionalUuid(r.new_value)
    if (o) ids.add(o)
    if (n) ids.add(n)
  }

  const map = new Map<string, string>()
  if (ids.size > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', [...ids])
    for (const u of users ?? []) {
      const row = u as { id: string; full_name: string | null; email: string | null }
      const name = String(row.full_name || '').trim() || String(row.email || '').trim()
      map.set(row.id, name || '(sem nome)')
    }
  }

  const labelFor = (raw: string): { id: string | null; label: string } => {
    const id = parseOptionalUuid(raw)
    if (!id) return { id: null, label: '(nenhum)' }
    const name = map.get(id)
    if (name !== undefined) return { id, label: name }
    return { id, label: '(usuário não encontrado)' }
  }

  return rows.map((r) => {
    if (r.field_key !== 'sale_commission_user_id') return r
    const oldPart = labelFor(r.old_value)
    const newPart = labelFor(r.new_value)
    return {
      ...r,
      old_value: userHistoryPayload(oldPart.id, oldPart.label),
      new_value: userHistoryPayload(newPart.id, newPart.label),
    }
  })
}

export function formatResaleUserHistoryDisplay (raw: string | null | undefined): string {
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

export function formatResaleCostsForHistoryDisplay (raw: string | null | undefined): string {
  const v = raw ?? ''
  if (!v.trim()) return '(nenhum)'
  try {
    const parsed = JSON.parse(v) as unknown
    if (!Array.isArray(parsed)) return v
    if (parsed.length === 0) return '(nenhum)'
    return parsed
      .map((item, index) => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        const desc = String(row.description ?? '').trim() || `Custo ${index + 1}`
        const cents = Number(row.value_cents)
        const money = Number.isFinite(cents) ? formatCentsBr(cents) : '—'
        return `${desc}: ${money}`
      })
      .join('\n')
  } catch {
    return v
  }
}

export function formatResalePaymentMethodsForHistoryDisplay (
  raw: string | null | undefined,
): string {
  const v = raw ?? ''
  if (!v.trim()) return '(nenhuma)'
  try {
    const parsed = JSON.parse(v) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return '(nenhuma)'
    return parsed
      .map((item, index) => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        const id = String(row.payment_method_id ?? '').trim() || '—'
        const installments = row.installments != null ? Number(row.installments) : null
        const valueCents = row.value_cents != null ? Number(row.value_cents) : null
        const parts = [`Forma ${index + 1}: ${id}`]
        if (installments != null && Number.isFinite(installments)) {
          parts.push(`${installments}x`)
        }
        if (valueCents != null && Number.isFinite(valueCents)) {
          parts.push(formatCentsBr(valueCents))
        }
        return parts.join(' · ')
      })
      .join('\n')
  } catch {
    return v
  }
}

export const RESALE_EDIT_FIELD_LABELS: Record<string, string> = {
  sold: 'Vendido',
  sold_for_cents: 'Valor da venda',
  sale_date: 'Data da venda',
  sale_payment_methods: 'Formas de pagamento',
  payment_method_id: 'Forma de pagamento',
  payment_installments: 'Parcelas',
  buyer_name: 'Comprador',
  buyer_cpf: 'CPF do comprador',
  sale_details: 'Detalhes da venda',
  sale_commission_user_id: 'Comissão (colaborador)',
  commission_paid_at: 'Comissão paga em',
  actual_profit_cents: 'Lucro real',
  costs: 'Custos',
  device_name: 'Aparelho',
  model: 'Modelo',
  color: 'Cor',
  storage_gb: 'Armazenamento',
  battery: 'Bateria',
  condition: 'Condição',
  info: 'Informações',
  imei: 'IMEI',
  imei2: 'IMEI 2',
  serial: 'Serial',
  purchase_value_cents: 'Valor de compra',
  wholesale_value_cents: 'Valor atacado',
  sale_value_cents: 'Valor varejo',
  expected_profit_sale_cents: 'Lucro esperado (varejo)',
  expected_profit_wholesale_cents: 'Lucro esperado (atacado)',
  advertised: 'Anunciado',
  tested: 'Testado',
  label: 'Etiqueta',
  purchase_date: 'Data de compra',
  stock_type: 'Tipo de estoque',
  device_model_id: 'Modelo do catálogo',
  image_url: 'URL da imagem',
  image_gallery_paths: 'Galeria',
}
