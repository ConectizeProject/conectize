/**
 * Identificador da empresa Bling usado para rotear webhooks (companyId no payload)
 * e metadata da hub_connection (empresaId no OAuth).
 */

export function normalizeBlingCompanyId (value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }
  const text = String(value).trim()
  if (!text) return null
  if (/^\d+$/.test(text)) return text.replace(/^0+(?=\d)/, '') || '0'
  return text
}

export function hubConnectionCompanyId (metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const meta = metadata as Record<string, unknown>
  return (
    normalizeBlingCompanyId(meta.empresaId)
    ?? normalizeBlingCompanyId(meta.companyId)
    ?? normalizeBlingCompanyId(meta.idEmpresa)
  )
}

export function blingCompanyIdsMatch (left: unknown, right: unknown): boolean {
  const a = normalizeBlingCompanyId(left)
  const b = normalizeBlingCompanyId(right)
  if (!a || !b) return false
  return a === b
}

export function withBlingCompanyIdMetadata (
  metadata: Record<string, unknown> | null | undefined,
  companyId: string | null,
): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object' ? { ...metadata } : {}
  const normalized = normalizeBlingCompanyId(companyId)
  if (!normalized) return base
  return {
    ...base,
    empresaId: normalized,
    companyId: normalized,
  }
}
