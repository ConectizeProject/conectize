import { CONECTIZE_HOST_ORGANIZATION_ID } from '@/lib/organizations/constants'

/** Orgs visíveis no catálogo: host (Conectize) + organização atual. */
export function deviceCatalogOrganizationIds (organizationId: string): string[] {
  const current = String(organizationId || '').trim()
  if (!current) return [CONECTIZE_HOST_ORGANIZATION_ID]
  if (current === CONECTIZE_HOST_ORGANIZATION_ID) return [current]
  return [CONECTIZE_HOST_ORGANIZATION_ID, current]
}

export function isHostCatalogOrganization (organizationId: string | null | undefined): boolean {
  return String(organizationId || '').trim() === CONECTIZE_HOST_ORGANIZATION_ID
}

/**
 * Prefere itens do host quando há o mesmo nome (case-insensitive).
 * Host primeiro na ordenação para ganhar o Map.
 */
export function preferHostCatalogRows <T extends { organization_id?: string | null }> (
  rows: T[],
  keyFn: (row: T) => string,
): T[] {
  const sorted = [...rows].sort((a, b) => {
    const aHost = isHostCatalogOrganization(a.organization_id) ? 0 : 1
    const bHost = isHostCatalogOrganization(b.organization_id) ? 0 : 1
    return aHost - bHost
  })
  const byKey = new Map<string, T>()
  for (const row of sorted) {
    const key = keyFn(row).trim().toLowerCase()
    if (!key || byKey.has(key)) continue
    byKey.set(key, row)
  }
  return [...byKey.values()]
}

export function canManageDeviceCatalogItem (
  itemOrganizationId: string | null | undefined,
  currentOrganizationId: string | null | undefined,
): boolean {
  const item = String(itemOrganizationId || '').trim()
  const current = String(currentOrganizationId || '').trim()
  return Boolean(item && current && item === current)
}
