export const VENDAS_LIST_PAGE_SIZE = 20

export function vendasListPage (raw: string | null | undefined) {
  const n = Number.parseInt(String(raw || ''), 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, 10_000)
}

export function vendasListRange (page: number, pageSize = VENDAS_LIST_PAGE_SIZE) {
  const safePage = Math.max(1, page)
  const from = (safePage - 1) * pageSize
  return { from, to: from + pageSize - 1, page: safePage, pageSize }
}
