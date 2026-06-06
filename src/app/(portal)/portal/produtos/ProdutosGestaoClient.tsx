'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { buildProdutosGestaoHref } from '@/lib/products/portal-gestao-produtos-list'
import { ProductsListClient, type ProductRow } from './ProductsListClient'
import { ProdutosFilterForm } from './ProdutosFilterForm'

type GestaoKind = 'product' | 'service' | 'all'

type FilterValues = {
  q: string
  kind: GestaoKind
  sku: string
  barcode: string
}

type ProdutosGestaoClientProps = {
  initialProducts: ProductRow[]
  totalCount: number
  listLoadError?: boolean
  query: string
  sku: string
  barcode: string
  kindFilter: GestaoKind
  invalidSearchTokens?: boolean
  initialEditProductId?: string
  initialCreateVariationParentId?: string
}

function filtersKey (f: FilterValues): string {
  return `${f.kind}::${f.q}::${f.sku}::${f.barcode}`
}

function syncUrl (href: string) {
  if (typeof window === 'undefined') return
  const current = window.location.pathname + window.location.search
  if (current === href) return
  window.history.replaceState(null, '', href)
}

export function ProdutosGestaoClient ({
  initialProducts,
  totalCount: initialTotalCount,
  listLoadError: initialListLoadError = false,
  query,
  sku,
  barcode,
  kindFilter,
  invalidSearchTokens: initialInvalidSearchTokens = false,
  initialEditProductId,
  initialCreateVariationParentId,
}: ProdutosGestaoClientProps) {
  const serverFiltersKey = filtersKey({ q: query, kind: kindFilter, sku, barcode })
  const lastServerFiltersKeyRef = useRef(serverFiltersKey)

  const [products, setProducts] = useState(initialProducts)
  const [totalCount, setTotalCount] = useState(initialTotalCount)
  const [listLoadError, setListLoadError] = useState(initialListLoadError)
  const [invalidSearchTokens, setInvalidSearchTokens] = useState(initialInvalidSearchTokens)
  const [activeFilters, setActiveFilters] = useState<FilterValues>({
    q: query,
    kind: kindFilter,
    sku,
    barcode,
  })
  const [isFiltering, setIsFiltering] = useState(false)
  const filterRequestRef = useRef(0)

  useEffect(() => {
    if (lastServerFiltersKeyRef.current === serverFiltersKey) return
    lastServerFiltersKeyRef.current = serverFiltersKey
    setProducts(initialProducts)
    setTotalCount(initialTotalCount)
    setListLoadError(initialListLoadError)
    setInvalidSearchTokens(initialInvalidSearchTokens)
    setActiveFilters({
      q: query,
      kind: kindFilter,
      sku,
      barcode,
    })
  }, [
    serverFiltersKey,
    initialProducts,
    initialTotalCount,
    initialListLoadError,
    initialInvalidSearchTokens,
    query,
    kindFilter,
    sku,
    barcode,
  ])

  const applyFilters = useCallback(async (next: FilterValues) => {
    const href = buildProdutosGestaoHref({
      q: next.q,
      kind: next.kind,
      sku: next.sku.trim() || undefined,
      barcode: next.barcode.trim() || undefined,
    })
    syncUrl(href)

    const nextKey = filtersKey(next)
    if (nextKey === filtersKey(activeFilters) && !listLoadError) {
      return
    }

    const requestId = ++filterRequestRef.current
    setIsFiltering(true)
    setActiveFilters(next)

    try {
      const params = new URLSearchParams()
      params.set('offset', '0')
      params.set('limit', '20')
      const q = next.q.trim()
      if (q) params.set('q', q)
      if (next.kind === 'service') params.set('kind', 'service')
      else if (next.kind === 'product') params.set('kind', 'product')
      const sk = next.sku.trim()
      if (sk) params.set('sku', sk)
      const bc = next.barcode.trim()
      if (bc) params.set('barcode', bc)

      const res = await fetch(`/api/portal/produtos/gestao-list?${params.toString()}`)
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        items?: ProductRow[]
        totalCount?: number
        hasSearchButNoValidTokens?: boolean
        error?: string
      } | null

      if (requestId !== filterRequestRef.current) return

      if (!res.ok || !data?.ok) {
        setListLoadError(true)
        setProducts([])
        setTotalCount(0)
        setInvalidSearchTokens(false)
        return
      }

      setListLoadError(false)
      setProducts(Array.isArray(data.items) ? data.items : [])
      setTotalCount(typeof data.totalCount === 'number' ? data.totalCount : 0)
      setInvalidSearchTokens(Boolean(data.hasSearchButNoValidTokens))
    } catch {
      if (requestId !== filterRequestRef.current) return
      setListLoadError(true)
      setProducts([])
      setTotalCount(0)
      setInvalidSearchTokens(false)
    } finally {
      if (requestId === filterRequestRef.current) {
        setIsFiltering(false)
      }
    }
  }, [activeFilters, listLoadError])

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <ProdutosFilterForm
        initialQ={activeFilters.q}
        initialSku={activeFilters.sku}
        initialBarcode={activeFilters.barcode}
        kind={activeFilters.kind}
        withGestaoTab
        isSubmitting={isFiltering}
        onApply={applyFilters}
      />

      <ProductsListClient
        key={filtersKey(activeFilters)}
        products={products}
        totalCount={totalCount}
        listLoadError={listLoadError}
        searchQuery={activeFilters.q}
        filterSku={activeFilters.sku}
        filterBarcode={activeFilters.barcode}
        invalidSearchTokens={invalidSearchTokens}
        filterKind={activeFilters.kind}
        initialEditProductId={initialEditProductId}
        initialCreateVariationParentId={initialCreateVariationParentId}
      />
    </div>
  )
}
