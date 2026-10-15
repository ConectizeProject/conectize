import { describe, expect, it } from 'vitest'
import { searchLocalCatalog } from '@/app/(portal)/portal/pdv/pdv-catalog-cache'
import type { CatalogProduct } from '@/app/(portal)/portal/pdv/pdv-types'

function product (partial: Pick<CatalogProduct, 'id' | 'name'> & Partial<CatalogProduct>): CatalogProduct {
  return {
    sku: null,
    barcode: null,
    sale_price_cents: 0,
    image_url: null,
    stock: 0,
    kind: 'product',
    ...partial,
  }
}

describe('searchLocalCatalog', () => {
  const catalog = [
    product({ id: '1', name: 'Bateria iPhone Modelo:11', sku: 'BATERIAIP11' }),
    product({ id: '1p', name: 'Bateria iPhone Modelo:11 Pro', sku: 'BATERIAIP11P' }),
    product({ id: '2', name: 'Bateria iPhone Modelo:12 Pro Max', sku: 'BATERIAIP12PM', barcode: '7611196728956' }),
    product({ id: '3', name: 'Película iPhone 11', sku: 'PEL11' }),
  ]

  it('encontra o modelo 11 sem trazer outras baterias pelo código de barras', () => {
    const hits = searchLocalCatalog(catalog, 'bateria 11', 10)
    expect(hits.map((hit) => hit.id)).toEqual(['1', '1p'])
  })

  it('mantém a busca por uma palavra só', () => {
    const hits = searchLocalCatalog(catalog, 'película', 10)
    expect(hits.map((hit) => hit.id)).toEqual(['3'])
  })
})