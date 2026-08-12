import type { CatalogProduct } from './pdv-types'

const SESSION_PREFIX = 'conectize:pdv:catalog-snapshot:v1:'

function normalizeSearchText (value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function sessionKey (organizationId: string) {
  return `${SESSION_PREFIX}${organizationId}`
}

export function scoreCatalogMatch (product: CatalogProduct, query: string) {
  const q = normalizeSearchText(query)
  if (!q) return 0

  const name = normalizeSearchText(product.name || '')
  const sku = normalizeSearchText(product.sku || '')
  const barcode = normalizeSearchText(product.barcode || '')

  if (barcode && barcode === q) return 100
  if (sku && sku === q) return 90
  if (name.startsWith(q)) return 80
  if (sku.startsWith(q)) return 70
  if (barcode.includes(q)) return 60
  if (name.includes(q)) return 50
  if (sku.includes(q)) return 40
  return 0
}

export function searchLocalCatalog (products: CatalogProduct[], query: string, limit = 10) {
  const q = query.trim()
  if (!q || products.length === 0) return [] as CatalogProduct[]

  return products
    .map((product) => ({ product, score: scoreCatalogMatch(product, q) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, 'pt-BR'))
    .slice(0, limit)
    .map((row) => row.product)
}

export function findLocalCatalogByCode (products: CatalogProduct[], code: string) {
  const needle = code.trim()
  if (!needle || products.length === 0) return null

  const exactBarcode = products.find((product) => (product.barcode || '').trim() === needle)
  if (exactBarcode) return exactBarcode

  const exactSku = products.find((product) => {
    const sku = (product.sku || '').trim()
    return sku === needle || sku.toLowerCase() === needle.toLowerCase()
  })
  return exactSku || null
}

/** Cache de sessão (aba). Usado para hidratar rápido após F5 com caixa já aberto. */
export function readSessionCatalogSnapshot (organizationId: string | null | undefined): CatalogProduct[] | null {
  if (!organizationId || typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(sessionKey(organizationId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { products?: unknown }
    if (!Array.isArray(parsed?.products)) return null
    const products = parsed.products.filter((row): row is CatalogProduct => (
      Boolean(row)
      && typeof row === 'object'
      && typeof (row as CatalogProduct).id === 'string'
      && typeof (row as CatalogProduct).name === 'string'
    ))
    return products.length > 0 ? products : null
  } catch {
    return null
  }
}

export function writeSessionCatalogSnapshot (
  organizationId: string | null | undefined,
  products: CatalogProduct[],
) {
  if (!organizationId || typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(sessionKey(organizationId), JSON.stringify({ products }))
  } catch {
    // Quota — mantém só em memória.
  }
}
