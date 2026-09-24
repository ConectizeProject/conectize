import { parseServicesJson } from '@/lib/orders/order-form-parsers'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

export type SoldListSource = 'sale' | 'service_order'

export type SoldOsProductLine = {
  lineIndex: number
  productId: string
  description: string
  quantity: number
  unitValueCents: number
  unitCostCents: number
  valueCents: number
}

/** Aceita array JSONB da OS ou payload `{ items }` / string JSON. */
export function parseOsServicesPayload (services: unknown) {
  if (Array.isArray(services)) {
    return parseServicesJson(JSON.stringify({ items: services }))
  }
  if (services && typeof services === 'object' && Array.isArray((services as { items?: unknown }).items)) {
    return parseServicesJson(JSON.stringify(services))
  }
  if (typeof services === 'string') {
    const trimmed = services.trim()
    if (!trimmed) return parseServicesJson(null)
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parseServicesJson(JSON.stringify({ items: parsed }))
      }
      return parseServicesJson(trimmed)
    } catch {
      return parseServicesJson(null)
    }
  }
  return parseServicesJson(null)
}

/** Linhas de produto (não serviço) de uma OS, com índice original no JSON. */
export function extractOsSoldProductLines (services: unknown): SoldOsProductLine[] {
  const raw = Array.isArray(services)
    ? services
    : parseOsServicesPayload(services).items

  const lines: SoldOsProductLine[] = []
  if (!Array.isArray(raw)) return lines

  for (let lineIndex = 0; lineIndex < raw.length; lineIndex++) {
    const item = raw[lineIndex]
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (String(row.kind || '') !== 'product') continue
    const productId = parseOptionalUuid(row.sourceProductId)
    if (!productId) continue
    const quantityRaw = Number.parseInt(String(row.quantity ?? '1'), 10)
    const quantity =
      Number.isFinite(quantityRaw) && quantityRaw > 0
        ? Math.min(9999, Math.max(1, quantityRaw))
        : 1
    const unitValueCents = Math.max(
      0,
      Number(row.unitValueCents ?? row.valueCents ?? 0) || 0,
    )
    const noCost = row.noCost === true
    const unitCostCents = noCost
      ? 0
      : Math.max(0, Number(row.unitCostCents ?? row.costCents ?? 0) || 0)
    const valueCents =
      Math.max(0, Number(row.valueCents) || 0) || unitValueCents * quantity
    const description = String(row.description || '').trim() || 'Produto'
    lines.push({
      lineIndex,
      productId,
      description,
      quantity,
      unitValueCents,
      unitCostCents,
      valueCents,
    })
  }
  return lines
}

export function soldOsItemId (orderId: string, lineIndex: number) {
  return `os:${orderId}:${lineIndex}`
}

export function parseSoldOsItemId (itemId: string): { orderId: string, lineIndex: number } | null {
  const m = /^os:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):(\d+)$/i.exec(
    String(itemId || '').trim(),
  )
  if (!m) return null
  const lineIndex = Number.parseInt(m[2], 10)
  if (!Number.isFinite(lineIndex) || lineIndex < 0) return null
  return { orderId: m[1].toLowerCase(), lineIndex }
}

export function isCatalogServiceKind (kind: unknown) {
  return String(kind || '').toLowerCase() === 'service'
}
