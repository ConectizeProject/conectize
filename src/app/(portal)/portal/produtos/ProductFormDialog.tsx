'use client'

import { useCallback, useEffect, useState } from 'react'
import { GripVertical, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { cn, formatCurrency } from '@/lib/utils'
import type { Product } from '@/lib/products/service'
import {
  ProductForm,
  type ProductFormProduct,
  type ProductFormSubmitPayload,
  type CompatibleEntry,
} from './ProductForm'
import { ProductStockPanel } from './ProductStockPanel'

type SavePhase = 'idle' | 'saving' | 'syncing'

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  /** Edição: id do produto; criação: null */
  productId: string | null
  initialName?: string
  initialBlingId?: string | null
  initialParentProductId?: string | null
  initialParentBlingId?: string | null
  initialParentName?: string | null
  defaultKind?: 'product' | 'service'
  /** Só edição: aba inicial (ex.: abrir pela coluna Estoque). */
  initialEditTab?: 'dados' | 'variacoes' | 'estoque'
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  /** Atualiza o saldo na lista sem recarregar a página. */
  onStockChange?: (productId: string, currentStock: number) => void
  onNavigateToProductId?: (id: string) => void
  onCreateVariationFromParent?: (parent: { id: string, name: string, blingId: string | null }) => void
}

function mapProductToForm (p: Product): ProductFormProduct {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    description: p.description,
    imageUrl: p.imageUrl ?? null,
    salePriceCents: p.salePriceCents,
    costPriceCents: p.costPriceCents,
    pricingTagId: p.pricingTagId,
    isActive: p.isActive !== false,
    kind: p.kind === 'service' ? 'service' : 'product',
    ncm: p.ncm,
    cest: p.cest,
    cfop: p.cfop,
    fiscalOrigin: p.fiscalOrigin,
    fci: p.fci,
    fiscalUnit: p.fiscalUnit,
    icmsCsosn: p.icmsCsosn,
    icmsCst: p.icmsCst,
    pisCst: p.pisCst,
    cofinsCst: p.cofinsCst,
    variationAttributeKeys: p.variationAttributeKeys,
    variationAttributeValues: p.variationAttributeValues,
  }
}

export function ProductFormDialog ({
  open,
  mode,
  productId,
  initialName,
  initialBlingId,
  initialParentProductId,
  initialParentBlingId,
  initialParentName,
  defaultKind = 'product',
  initialEditTab,
  onOpenChange,
  onSuccess,
  onStockChange,
  onNavigateToProductId,
  onCreateVariationFromParent,
}: Props) {
  const { toast } = useToast()
  const [formProduct, setFormProduct] = useState<ProductFormProduct | null>(null)
  /** Dados completos da API (Bling, parentBlingId, etc.) — não duplicados em ProductFormProduct */
  const [loadedProduct, setLoadedProduct] = useState<Product | null>(null)
  const [compatibleModels, setCompatibleModels] = useState<CompatibleEntry[]>([])
  const [variations, setVariations] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [savePhase, setSavePhase] = useState<SavePhase>('idle')
  const [draggingVariationId, setDraggingVariationId] = useState<string | null>(null)
  const [dragOverVariationId, setDragOverVariationId] = useState<string | null>(null)
  const [reorderingVariations, setReorderingVariations] = useState(false)
  const [editTab, setEditTab] = useState<'dados' | 'variacoes' | 'estoque'>('dados')
  const [syncingProduct, setSyncingProduct] = useState(false)
  const [syncingStock, setSyncingStock] = useState(false)
  const [applyImageChildrenBusy, setApplyImageChildrenBusy] = useState(false)
  const [parentSummaryForVariation, setParentSummaryForVariation] = useState<{
    id: string
    name: string
    sku: string | null
    imageUrl: string | null
    blingId: string | null
    salePriceCents: number | null
    isActive: boolean
    variationAttributeKeys: string[]
  } | null>(null)
  const [createParentAttrKeys, setCreateParentAttrKeys] = useState<string[]>([])
  const [createParentName, setCreateParentName] = useState<string | null>(null)
  const [parentVariationKeysPortalEl, setParentVariationKeysPortalEl] = useState<HTMLDivElement | null>(null)

  const loadEdit = useCallback(async () => {
    if (!productId || mode !== 'edit') return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/portal/produtos/${productId}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !data?.product) {
        throw new Error(data?.message || data?.error || 'Não foi possível carregar o item.')
      }
      const raw = data.product as Product
      setLoadedProduct(raw)
      setFormProduct(mapProductToForm(raw))
      setCompatibleModels(
        Array.isArray(data.compatibleModels)
          ? (data.compatibleModels as CompatibleEntry[])
          : [],
      )
      setVariations(Array.isArray(data.variations) ? (data.variations as Product[]) : [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erro ao carregar.')
      setFormProduct(null)
      setLoadedProduct(null)
      setCompatibleModels([])
      setVariations([])
    } finally {
      setLoading(false)
    }
  }, [productId, mode])

  useEffect(() => {
    if (!open) return
    setSavePhase('idle')
    setSyncingProduct(false)
    setSyncingStock(false)
    setApplyImageChildrenBusy(false)
    setReorderingVariations(false)
    setDraggingVariationId(null)
    setDragOverVariationId(null)
    if (mode === 'create') {
      setFormProduct(null)
      setLoadedProduct(null)
      setCompatibleModels([])
      setVariations([])
      setLoadError(null)
      setLoading(false)
      return
    }
    void loadEdit()
  }, [open, mode, productId, loadEdit, reloadKey])

  useEffect(() => {
    if (open) return
    setFormProduct(null)
    setLoadedProduct(null)
    setCompatibleModels([])
    setVariations([])
    setLoading(false)
    setLoadError(null)
    setSavePhase('idle')
    setEditTab('dados')
    setApplyImageChildrenBusy(false)
    setParentSummaryForVariation(null)
    setCreateParentAttrKeys([])
    setCreateParentName(null)
    setParentVariationKeysPortalEl(null)
  }, [open])

  useEffect(() => {
    if (!open || mode !== 'edit') return
    setEditTab(initialEditTab ?? 'dados')
  }, [open, mode, productId, initialEditTab])

  useEffect(() => {
    if (!loadedProduct || loadedProduct.kind !== 'service') return
    setEditTab('dados')
  }, [loadedProduct?.id, loadedProduct?.kind])

  useEffect(() => {
    const isVar = Boolean(loadedProduct?.parentBlingId || loadedProduct?.parentProductId)
    if (isVar && editTab === 'variacoes') {
      setEditTab('dados')
      return
    }
    const isParent = loadedProduct?.kind !== 'service' && !isVar && variations.length > 0
    if (!isParent) return
    if (editTab === 'estoque') setEditTab('dados')
  }, [
    loadedProduct?.kind,
    loadedProduct?.parentBlingId,
    loadedProduct?.parentProductId,
    variations.length,
    editTab,
  ])

  useEffect(() => {
    const pid = loadedProduct?.parentProductId
    if (!open || mode !== 'edit' || !pid) {
      setParentSummaryForVariation(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/portal/produtos/${pid}`)
        const data = await res.json().catch(() => null)
        if (cancelled || !res.ok || !data?.ok || !data?.product) return
        const parent = data.product as Product
        setParentSummaryForVariation({
          id: parent.id,
          name: parent.name?.trim() || 'Produto pai',
          sku: parent.sku ?? null,
          imageUrl:
            parent.imageUrl != null && String(parent.imageUrl).trim()
              ? String(parent.imageUrl).trim()
              : null,
          blingId: parent.blingId ?? null,
          salePriceCents:
            typeof parent.salePriceCents === 'number' ? parent.salePriceCents : null,
          isActive: parent.isActive !== false,
          variationAttributeKeys: Array.isArray(parent.variationAttributeKeys)
            ? parent.variationAttributeKeys
            : [],
        })
      } catch {
        if (!cancelled) setParentSummaryForVariation(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, mode, loadedProduct?.parentProductId])

  useEffect(() => {
    if (!open || mode !== 'create' || !initialParentProductId) {
      setCreateParentAttrKeys([])
      setCreateParentName(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/portal/produtos/${initialParentProductId}`)
        const data = await res.json().catch(() => null)
        if (cancelled || !res.ok || !data?.ok || !data?.product) return
        const p = data.product as Product
        setCreateParentAttrKeys(
          Array.isArray(p.variationAttributeKeys) ? p.variationAttributeKeys : [],
        )
        setCreateParentName(p.name?.trim() || null)
      } catch {
        if (!cancelled) {
          setCreateParentAttrKeys([])
          setCreateParentName(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, mode, initialParentProductId])

  async function handleSubmit (payload: ProductFormSubmitPayload) {
    if (savePhase !== 'idle') return

    if (mode === 'create') {
      setSavePhase('saving')
      try {
        const res = await fetch('/api/portal/produtos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: payload.name,
            kind: payload.kind,
            sku: payload.sku,
            barcode: payload.barcode,
            description: payload.description,
            imageUrl: payload.imageUrl,
            salePrice: payload.salePrice,
            costPrice: payload.costPrice,
            isActive: payload.isActive,
            initialStock: payload.initialStock,
            pricingTagId: payload.pricingTagId,
            ncm: payload.ncm,
            cest: payload.cest,
            cfop: payload.cfop,
            fiscalOrigin: payload.fiscalOrigin,
            fci: payload.fci,
            fiscalUnit: payload.fiscalUnit,
            icmsCsosn: payload.icmsCsosn,
            icmsCst: payload.icmsCst,
            pisCst: payload.pisCst,
            cofinsCst: payload.cofinsCst,
            compatibleModelIds: payload.compatibleModelIds,
            parentProductId: initialParentProductId || null,
            parentBlingId: initialParentBlingId || null,
            ...(payload.variationAttributeKeys !== undefined
              ? { variationAttributeKeys: payload.variationAttributeKeys }
              : {}),
            ...(payload.variationAttributeValues !== undefined
              ? { variationAttributeValues: payload.variationAttributeValues }
              : {}),
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          setSavePhase('idle')
          toast({
            title: 'Erro ao criar',
            description: data?.message || (
              data?.error === 'invalid_barcode'
                ? 'Informe um EAN/GTIN válido (8, 12, 13 ou 14 dígitos) ou deixe em branco.'
                : data?.error === 'invalid_ncm'
                  ? 'Informe o NCM com 8 dígitos (0000.00.00) ou deixe em branco.'
                  : data?.error === 'invalid_cest'
                    ? 'Informe o CEST com 7 dígitos (00.000.00) ou deixe em branco.'
                    : String(data?.error || 'Tente novamente.')
            ),
            variant: 'destructive',
          })
          return
        }
        toast({
          variant: 'success',
          title: payload.kind === 'service' ? 'Serviço criado' : 'Produto criado',
          description: 'Os dados foram salvos.',
        })
        setSavePhase('idle')
        onOpenChange(false)
        onSuccess?.()
      } catch {
        setSavePhase('idle')
        toast({ title: 'Erro ao criar', variant: 'destructive' })
      }
      return
    }

    if (!productId) return

    setSavePhase('saving')
    try {
      const res = await fetch(`/api/portal/produtos/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.name,
          kind: payload.kind,
          sku: payload.sku,
          barcode: payload.barcode,
          description: payload.description,
          imageUrl: payload.imageUrl,
          salePrice: payload.salePrice,
          costPrice: payload.costPrice,
          isActive: payload.isActive,
          pricingTagId: payload.pricingTagId,
          ncm: payload.ncm,
          cest: payload.cest,
          cfop: payload.cfop,
          fiscalOrigin: payload.fiscalOrigin,
          fci: payload.fci,
          fiscalUnit: payload.fiscalUnit,
          icmsCsosn: payload.icmsCsosn,
          icmsCst: payload.icmsCst,
          pisCst: payload.pisCst,
          cofinsCst: payload.cofinsCst,
          compatibleModelIds: payload.compatibleModelIds,
          ...(payload.variationAttributeKeys !== undefined
            ? { variationAttributeKeys: payload.variationAttributeKeys }
            : {}),
          ...(payload.variationAttributeValues !== undefined
            ? { variationAttributeValues: payload.variationAttributeValues }
            : {}),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setSavePhase('idle')
        toast({
          title: 'Erro ao salvar',
          description: data?.message || data?.error || 'Não foi possível salvar.',
          variant: 'destructive',
        })
        return
      }

      const nextProduct = (data.product || null) as Product | null
      if (nextProduct) {
        setLoadedProduct(nextProduct)
        setFormProduct(mapProductToForm(nextProduct))
      }

      const hasBling = Boolean(nextProduct?.blingId)

      if (hasBling) {
        setSavePhase('syncing')
        const syncPayload =
          Array.isArray(data.blingFieldsChanged)
            ? JSON.stringify({ portalFieldsChanged: data.blingFieldsChanged })
            : undefined
        const syncRes = await fetch(`/api/portal/produtos/${productId}/sync-bling`, {
          method: 'POST',
          headers: syncPayload ? { 'Content-Type': 'application/json' } : undefined,
          body: syncPayload,
        })
        const syncData = await syncRes.json().catch(() => null)
        if (!syncRes.ok || !syncData?.ok) {
          setSavePhase('idle')
          toast({
            title: 'Erro ao sincronizar com o Bling',
            description: syncData?.message || syncData?.error || 'Salvo no portal; falha ao enviar ao Bling.',
            variant: 'destructive',
          })
          onSuccess?.()
          return
        }
        const syncedProduct = (syncData.product || null) as Product | null
        if (syncedProduct) {
          setLoadedProduct(syncedProduct)
          setFormProduct(mapProductToForm(syncedProduct))
        }
      }

      toast({
        variant: 'success',
        title: payload.kind === 'service' ? 'Serviço atualizado' : 'Produto atualizado',
        description: hasBling ? 'Salvo e sincronizado com o Bling.' : 'Alterações salvas.',
      })
      setSavePhase('idle')
      onOpenChange(false)
      onSuccess?.()
    } catch {
      setSavePhase('idle')
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  async function callSyncEndpoint (
    url: string,
    setLoading: (value: boolean) => void,
    successTitle: string,
  ) {
    if (!productId) return
    setLoading(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          variant: 'destructive',
          title: 'Erro na sincronização',
          description: data?.message || data?.error || 'Tente novamente.',
        })
        return
      }
      toast({ variant: 'success', title: successTitle })
      await loadEdit()
      onSuccess?.()
    } finally {
      setLoading(false)
    }
  }

  function moveVariationInList (list: Product[], fromId: string, toId: string): Product[] {
    if (fromId === toId) return list
    const fromIdx = list.findIndex((v) => v.id === fromId)
    const toIdx = list.findIndex((v) => v.id === toId)
    if (fromIdx < 0 || toIdx < 0) return list
    const next = [...list]
    const [item] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, item)
    return next
  }

  async function persistVariationOrder (nextList: Product[]) {
    if (!productId) return
    const ids = nextList.map((v) => v.id)
    if (ids.length === 0) return
    setReorderingVariations(true)
    try {
      const res = await fetch(`/api/portal/produtos/${productId}/variations-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variationIds: ids }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Falha ao atualizar ordem')
      }
      setVariations(Array.isArray(data.variations) ? (data.variations as Product[]) : nextList)
      toast({ variant: 'success', title: 'Ordem das variações atualizada' })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao ordenar variações',
        description: 'Tente novamente.',
      })
      void loadEdit()
    } finally {
      setReorderingVariations(false)
      setDraggingVariationId(null)
      setDragOverVariationId(null)
    }
  }

  const title = mode === 'create'
    ? (initialParentProductId
        ? `Nova variação de ${initialParentName || 'produto pai'}`
        : 'Novo produto/serviço')
    : 'Editar produto/serviço'

  const blingIdLabel = (() => {
    const b = loadedProduct?.blingId ?? initialBlingId
    if (b != null && String(b).trim()) return String(b)
    return '—'
  })()

  const isEditProductWithStock = Boolean(
    loadedProduct && loadedProduct.kind !== 'service',
  )
  const isVariationChild = Boolean(
    loadedProduct?.parentBlingId || loadedProduct?.parentProductId,
  )
  const isParentWithVariations = Boolean(
    isEditProductWithStock && !isVariationChild && variations.length > 0,
  )
  const canManageVariationsTab = Boolean(
    loadedProduct && !isVariationChild && onCreateVariationFromParent,
  )
  const mountProductEditTabPanels = isEditProductWithStock
  const productEditTabMountProps = mountProductEditTabPanels
    ? { forceMount: true as const }
    : {}
  const variationTabPanelClass = cn(
    'mt-0 focus-visible:outline-none',
    mountProductEditTabPanels && 'data-[state=inactive]:hidden',
  )

  const handleApplyImageToVariationChildren = useCallback(async (url: string | null) => {
    if (!productId) return
    setApplyImageChildrenBusy(true)
    try {
      const res = await fetch(
        `/api/portal/produtos/${encodeURIComponent(productId)}/apply-image-to-variations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: url }),
        },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          variant: 'destructive',
          title: 'Não foi possível aplicar nas variações',
          description: String(data?.error || 'Tente novamente.'),
        })
        return
      }
      const n = Number(data.updatedCount ?? 0)
      toast({
        variant: 'success',
        title: 'URL da foto aplicada',
        description:
          n === 0
            ? 'Não há variações ativas para atualizar.'
            : `${n} variação(ões) atualizadas.`,
      })
      setReloadKey((k) => k + 1)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Não foi possível aplicar nas variações',
        description: 'Falha de rede. Tente novamente.',
      })
    } finally {
      setApplyImageChildrenBusy(false)
    }
  }, [productId, toast])

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (savePhase !== 'idle') return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        className={cn(
          'flex max-h-[min(92vh,980px)] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0',
          mode === 'create' ? 'sm:max-w-2xl' : 'sm:max-w-5xl',
        )}
      >
        <DialogDescription className="sr-only">
          {mode === 'create'
            ? 'Cadastro de produto ou serviço: preços, imagem, modelos compatíveis e variações quando aplicável.'
            : 'Edição de produto ou serviço: dados, variações e estoque.'}
        </DialogDescription>
        {mode === 'create' ? (
          <>
            <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <ProductForm
                key={initialParentProductId ? `create-var-${initialParentProductId}` : 'create'}
                mode="create"
                defaultKind={defaultKind}
                embed
                initialCompatibleModels={[]}
                creatingAsVariation={Boolean(initialParentProductId)}
                parentProductNameForVariation={createParentName}
                parentVariationAttributeKeys={createParentAttrKeys}
                onCancel={() => onOpenChange(false)}
                onSubmit={handleSubmit}
              />
            </div>
          </>
        ) : (
          <>
            {loading && (
              <>
                <DialogHeader className="sr-only">
                  <DialogTitle>Editar produto</DialogTitle>
                </DialogHeader>
                <div className="flex min-h-40 items-center justify-center px-6 py-4 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando dados de {initialName || 'item'}...
                </div>
              </>
            )}

            {!loading && loadError && (
              <>
                <DialogHeader className="sr-only">
                  <DialogTitle>Editar produto</DialogTitle>
                </DialogHeader>
                <div className="px-6 py-4">
                  <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
                    <p className="text-sm text-destructive">{loadError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setReloadKey((k) => k + 1)}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                </div>
              </>
            )}

            {!loading && !loadError && formProduct && loadedProduct && (
              <Tabs
                value={editTab}
                onValueChange={(v) => {
                  setEditTab(v as 'dados' | 'variacoes' | 'estoque')
                }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <DialogHeader className="shrink-0 space-y-3 border-b px-6 pt-4 pb-0 text-left">
                  <div className="space-y-1 pr-8">
                    <DialogTitle className="truncate text-base font-semibold tracking-tight sm:text-lg">
                      {formProduct.name?.trim() || initialName || 'Editar produto'}
                    </DialogTitle>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      <span className="text-muted-foreground/90">ID portal</span>
                      {' '}
                      <span className="font-mono tabular-nums text-foreground/70 select-all">
                        {formProduct.id}
                      </span>
                      <span className="mx-1.5 text-muted-foreground/40" aria-hidden>·</span>
                      <span className="text-muted-foreground/90">Bling</span>
                      {' '}
                      <span className="font-mono tabular-nums text-foreground/70 select-all">
                        {blingIdLabel}
                      </span>
                    </p>
                  </div>
                  <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-0 bg-transparent p-0">
                    <TabsTrigger
                      value="dados"
                      className="rounded-none border-b-2 border-transparent px-3 pb-2.5 pt-1 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Dados
                    </TabsTrigger>
                    {isEditProductWithStock && !isVariationChild ? (
                      <TabsTrigger
                        value="variacoes"
                        className="rounded-none border-b-2 border-transparent px-3 pb-2.5 pt-1 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                      >
                        Variações
                      </TabsTrigger>
                    ) : null}
                    {isEditProductWithStock && !isParentWithVariations ? (
                      <TabsTrigger
                        value="estoque"
                        className="rounded-none border-b-2 border-transparent px-3 pb-2.5 pt-1 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                      >
                        Estoque
                      </TabsTrigger>
                    ) : null}
                  </TabsList>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <TabsContent
                    value="dados"
                    {...productEditTabMountProps}
                    className={variationTabPanelClass}
                  >
                    {(loadedProduct.blingId || savePhase !== 'idle' || isVariationChild) ? (
                      <div className="mb-5 space-y-3">
                        {isVariationChild && parentSummaryForVariation ? (
                          <div className="flex gap-3 rounded-lg border border-border/80 bg-muted/15 p-3 sm:p-3.5">
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border/70 bg-background">
                              {parentSummaryForVariation.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={parentSummaryForVariation.imageUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                  Sem foto
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                Produto pai
                              </p>
                              <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                                {parentSummaryForVariation.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {parentSummaryForVariation.sku
                                  ? (
                                    <>
                                      SKU{' '}
                                      <span className="font-mono tabular-nums text-foreground/80">
                                        {parentSummaryForVariation.sku}
                                      </span>
                                    </>
                                  )
                                  : 'Sem SKU'}
                                {parentSummaryForVariation.salePriceCents != null ? (
                                  <>
                                    <span className="mx-1.5 text-muted-foreground/40" aria-hidden>·</span>
                                    {formatCurrency(parentSummaryForVariation.salePriceCents / 100)}
                                  </>
                                ) : null}
                                <span className="mx-1.5 text-muted-foreground/40" aria-hidden>·</span>
                                {parentSummaryForVariation.isActive ? 'Ativo' : 'Inativo'}
                              </p>
                            </div>
                            {onNavigateToProductId ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shrink-0 self-center"
                                disabled={savePhase !== 'idle'}
                                onClick={() => onNavigateToProductId(parentSummaryForVariation.id)}
                              >
                                Abrir pai
                              </Button>
                            ) : null}
                          </div>
                        ) : null}

                        {loadedProduct.blingId ? (
                          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-muted/15 px-3 py-2.5">
                            <p className="mr-auto text-xs text-muted-foreground">
                              Integração Bling
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={savePhase !== 'idle' || syncingProduct}
                              onClick={() => callSyncEndpoint(
                                '/api/portal/bling/sync-product',
                                setSyncingProduct,
                                'Dados atualizados pelo Bling.',
                              )}
                            >
                              {syncingProduct ? 'Atualizando...' : 'Atualizar dados'}
                            </Button>
                            {loadedProduct.kind !== 'service' && !isParentWithVariations ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={savePhase !== 'idle' || syncingStock}
                                onClick={() => callSyncEndpoint(
                                  '/api/portal/bling/sync-stock',
                                  setSyncingStock,
                                  'Estoque sincronizado com Bling.',
                                )}
                              >
                                {syncingStock ? 'Sincronizando...' : 'Sincronizar estoque'}
                              </Button>
                            ) : null}
                          </div>
                        ) : null}

                        {savePhase !== 'idle' ? (
                          <div
                            className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground"
                            aria-live="polite"
                          >
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                            <span className="font-medium text-foreground">
                              {savePhase === 'saving' && 'Salvando…'}
                              {savePhase === 'syncing' && 'Sincronizando com o Bling…'}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <ProductForm
                      key={`${formProduct.id}-${reloadKey}`}
                      mode="edit"
                      product={formProduct}
                      initialCompatibleModels={compatibleModels}
                      defaultKind={defaultKind}
                      embed
                      isVariation={Boolean(
                        loadedProduct.parentBlingId || loadedProduct.parentProductId,
                      )}
                      parentProductNameForVariation={parentSummaryForVariation?.name ?? null}
                      parentVariationAttributeKeys={
                        parentSummaryForVariation?.variationAttributeKeys ?? []
                      }
                      variationAttributeKeysPortalEl={
                        !isVariationChild && isEditProductWithStock
                          ? parentVariationKeysPortalEl
                          : null
                      }
                      embedVariationKeysInVariationsTab={!isVariationChild && isEditProductWithStock}
                      variationChildCount={isVariationChild ? 0 : variations.length}
                      applyImageToChildrenBusy={applyImageChildrenBusy}
                      onApplyImageToVariationChildren={
                        !isVariationChild ? handleApplyImageToVariationChildren : undefined
                      }
                      onCancel={() => onOpenChange(false)}
                      onSubmit={handleSubmit}
                    />
                  </TabsContent>

                  {isEditProductWithStock && !isVariationChild ? (
                    <>
                      <TabsContent
                        value="variacoes"
                        {...productEditTabMountProps}
                        className={variationTabPanelClass}
                      >
                          <div className="space-y-4">
                            <div ref={setParentVariationKeysPortalEl} className="min-h-0" />
                            {variations.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                                <p className="text-sm text-muted-foreground">
                                  Ainda não há variações cadastradas para este produto.
                                </p>
                                {canManageVariationsTab ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="mt-4"
                                    disabled={savePhase !== 'idle'}
                                    onClick={() => {
                                      if (!loadedProduct) return
                                      onCreateVariationFromParent?.({
                                        id: loadedProduct.id,
                                        name: loadedProduct.name,
                                        blingId: loadedProduct.blingId ?? null,
                                      })
                                    }}
                                  >
                                    Criar primeira variação
                                  </Button>
                                ) : null}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm text-muted-foreground">
                                    {variations.length}
                                    {' '}
                                    variação(ões)
                                    <span className="mx-1.5 text-muted-foreground/50" aria-hidden>
                                      ·
                                    </span>
                                    <span className="text-xs">arraste para reordenar</span>
                                  </p>
                                  {canManageVariationsTab ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={savePhase !== 'idle' || reorderingVariations}
                                      onClick={() => {
                                        if (!loadedProduct) return
                                        onCreateVariationFromParent?.({
                                          id: loadedProduct.id,
                                          name: loadedProduct.name,
                                          blingId: loadedProduct.blingId ?? null,
                                        })
                                      }}
                                    >
                                      Nova variação
                                    </Button>
                                  ) : null}
                                </div>
                                <div className="max-h-[min(52vh,420px)] overflow-auto rounded-md border border-border/60 bg-background">
                                  <table className="w-full min-w-0 text-sm">
                                    <thead>
                                      <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                                        <th className="w-10 px-2 py-2 font-medium" />
                                        <th className="px-2 py-2 font-medium">Nome</th>
                                        <th className="px-2 py-2 font-medium">SKU</th>
                                        <th className="px-2 py-2 text-right font-medium">Venda</th>
                                        <th className="px-2 py-2 text-right font-medium" />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {variations.map((v) => (
                                        <tr
                                          key={v.id}
                                          className={`border-b border-border/40 last:border-0 ${dragOverVariationId === v.id ? 'bg-primary/10' : ''}`}
                                          draggable={savePhase === 'idle' && !reorderingVariations}
                                          onDragStart={() => {
                                            if (savePhase !== 'idle' || reorderingVariations) return
                                            setDraggingVariationId(v.id)
                                            setDragOverVariationId(v.id)
                                          }}
                                          onDragOver={(event) => {
                                            if (!draggingVariationId) return
                                            event.preventDefault()
                                            if (dragOverVariationId !== v.id) {
                                              setDragOverVariationId(v.id)
                                            }
                                          }}
                                          onDrop={(event) => {
                                            if (!draggingVariationId) return
                                            event.preventDefault()
                                            const nextList = moveVariationInList(variations, draggingVariationId, v.id)
                                            if (nextList === variations) return
                                            setVariations(nextList)
                                            void persistVariationOrder(nextList)
                                          }}
                                          onDragEnd={() => {
                                            setDraggingVariationId(null)
                                            setDragOverVariationId(null)
                                          }}
                                        >
                                          <td className="px-2 py-2 text-center text-muted-foreground">
                                            <GripVertical className="mx-auto h-4 w-4" />
                                          </td>
                                          <td className="max-w-[240px] truncate px-2 py-2 font-medium text-foreground">
                                            {v.name}
                                          </td>
                                          <td className="px-2 py-2 text-muted-foreground">
                                            {v.sku || '—'}
                                          </td>
                                          <td className="px-2 py-2 text-right tabular-nums">
                                            {typeof v.salePriceCents === 'number' && v.salePriceCents > 0
                                              ? formatCurrency(v.salePriceCents / 100)
                                              : '—'}
                                          </td>
                                          <td className="px-2 py-2 text-right">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-8"
                                              disabled={savePhase !== 'idle' || reorderingVariations}
                                              onClick={() => onNavigateToProductId?.(v.id)}
                                            >
                                              Abrir
                                            </Button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                {reorderingVariations && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Salvando nova ordem...
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                      </TabsContent>
                    </>
                  ) : null}

                  {isEditProductWithStock && !isParentWithVariations ? (
                    <TabsContent
                      value="estoque"
                      {...productEditTabMountProps}
                      className={variationTabPanelClass}
                    >
                      {productId ? (
                        <ProductStockPanel
                          key={productId}
                          productId={productId}
                          productName={loadedProduct.name}
                          costPriceCents={loadedProduct.costPriceCents}
                          initialStock={0}
                          active={editTab === 'estoque'}
                          onStockChange={(currentStock) => {
                            onStockChange?.(productId, currentStock)
                          }}
                        />
                      ) : null}
                    </TabsContent>
                  ) : null}
                </div>
              </Tabs>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
