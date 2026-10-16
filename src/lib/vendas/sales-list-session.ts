import { parseSalesLane, type SalesLane } from '@/lib/vendas/sales-lane'

const STORAGE_KEY = 'conectize.portal.vendas.list-view'

export type SalesListSection = 'pedidos' | 'produtos'

export type SalesListSessionView = {
  section: SalesListSection
  lane: SalesLane
}

export function salesListSectionFromPath (pathname: string): SalesListSection | null {
  if (pathname === '/portal/vendas/produtos' || pathname === '/portal/vendas/produtos/') {
    return 'produtos'
  }
  if (pathname === '/portal/vendas' || pathname === '/portal/vendas/') return 'pedidos'
  return null
}

export function salesListPath (section: SalesListSection) {
  return section === 'produtos' ? '/portal/vendas/produtos' : '/portal/vendas'
}

export function salesListHref (view: SalesListSessionView) {
  const path = salesListPath(view.section)
  if (view.lane === 'all') return path
  return `${path}?lane=${encodeURIComponent(view.lane)}`
}

export function readSalesListSession (): SalesListSessionView | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { section?: unknown, lane?: unknown }
    const section = parsed.section === 'produtos' || parsed.section === 'pedidos'
      ? parsed.section
      : null
    const lane = parseSalesLane(typeof parsed.lane === 'string' ? parsed.lane : null)
    if (!section || !lane) return null
    return { section, lane }
  } catch (err) {
    void err
    return null
  }
}

export function writeSalesListSession (view: SalesListSessionView) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(view))
  } catch (err) {
    void err
  }
}

export function salesListSessionRedirectTarget (pathname: string, query: string): string | null {
  if (query) return null
  const saved = readSalesListSession()
  if (!saved) return null
  const target = salesListHref(saved)
  if (target === pathname) return null
  return target
}
