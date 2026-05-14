import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ProductsListClient } from './ProductsListClient'
import { ProdutosFilterForm } from './ProdutosFilterForm'
import { effectiveSearchTokens } from '@/lib/products/product-search'
import {
  buildProdutosGestaoHref,
  enrichGestaoRawRowsToProductRows,
  fetchGestaoListRawSlice,
  GESTAO_LIST_CHUNK,
  parseGestaoLoadedParam,
} from '@/lib/products/portal-gestao-produtos-list'

export { buildProdutosGestaoHref } from '@/lib/products/portal-gestao-produtos-list'

type ProdutosGestaoTabProps = {
  q: string
  loaded: string
  kind: string
  sku: string
  barcode: string
  /** Abre a modal de edição ao carregar (ex.: link da página de detalhes ou URL antiga /:id/editar). */
  initialEditProductId?: string
  /** Abre a modal de criação de variação vinculada ao produto pai. */
  initialCreateVariationParentId?: string
}

export async function ProdutosGestaoTab ({
  q,
  loaded: loadedRaw,
  kind,
  sku,
  barcode,
  initialEditProductId,
  initialCreateVariationParentId,
}: ProdutosGestaoTabProps) {
  const query = String(q || '').trim()
  const loaded = parseGestaoLoadedParam(loadedRaw)
  const kindRaw = String(kind || '').trim().toLowerCase()
  const kindFilter: 'product' | 'service' | 'all' =
    kindRaw === 'service' ? 'service' : kindRaw === 'product' ? 'product' : 'all'
  const skuRaw = String(sku || '')
  const barcodeRaw = String(barcode || '')

  const supabase = await createSupabaseServerClient()
  const searchTokens = effectiveSearchTokens(query)

  const slice = await fetchGestaoListRawSlice(supabase, {
    query,
    kindFilter,
    offset: 0,
    limit: loaded,
    sku: skuRaw,
    barcode: barcodeRaw,
  })

  const hrefOpts = {
    q: query,
    kind: kindFilter,
    sku: skuRaw.trim() || undefined,
    barcode: barcodeRaw.trim() || undefined,
  }

  if (slice.hasSearchButNoValidTokens && loaded > GESTAO_LIST_CHUNK) {
    redirect(buildProdutosGestaoHref(hrefOpts))
  }

  if (
    !slice.hasSearchButNoValidTokens
    && searchTokens.length > 0
    && kindFilter !== 'service'
    && slice.totalCount === 0
    && loaded > GESTAO_LIST_CHUNK
  ) {
    redirect(buildProdutosGestaoHref(hrefOpts))
  }

  if (slice.totalCount > 0 && loaded > slice.totalCount) {
    redirect(
      buildProdutosGestaoHref({
        ...hrefOpts,
        loaded: slice.totalCount,
      }),
    )
  }

  if (slice.totalCount === 0 && loaded > GESTAO_LIST_CHUNK && !slice.hasSearchButNoValidTokens) {
    redirect(buildProdutosGestaoHref(hrefOpts))
  }

  const productsWithStock = slice.listLoadError
    ? []
    : await enrichGestaoRawRowsToProductRows(supabase, slice.flatRows)

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <ProdutosFilterForm
        key={`${kindFilter}:${query}:${skuRaw}:${barcodeRaw}`}
        initialQ={query}
        initialSku={skuRaw}
        initialBarcode={barcodeRaw}
        kind={kindFilter}
        withGestaoTab
      />

      <ProductsListClient
        key={`${kindFilter}::${query}::${loaded}::${skuRaw}::${barcodeRaw}`}
        products={productsWithStock}
        totalCount={slice.totalCount}
        listLoadError={slice.listLoadError}
        searchQuery={query}
        filterSku={skuRaw}
        filterBarcode={barcodeRaw}
        invalidSearchTokens={slice.hasSearchButNoValidTokens}
        filterKind={kindFilter}
        initialEditProductId={initialEditProductId}
        initialCreateVariationParentId={initialCreateVariationParentId}
      />
    </div>
  )
}
