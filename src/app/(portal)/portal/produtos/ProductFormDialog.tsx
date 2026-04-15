'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@/lib/products/service'
import {
  ProductForm,
  type ProductFormProduct,
  type ProductFormSubmitPayload,
  type CompatibleEntry,
} from './ProductForm'

type SavePhase = 'idle' | 'saving' | 'syncing'

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  /** Edição: id do produto; criação: null */
  productId: string | null
  initialName?: string
  initialBlingId?: string | null
  defaultKind?: 'product' | 'service'
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  onNavigateToProductId?: (id: string) => void
}

function mapProductToForm (p: Product): ProductFormProduct {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    description: p.description,
    salePriceCents: p.salePriceCents,
    costPriceCents: p.costPriceCents,
    pricingTagId: p.pricingTagId,
    isActive: p.isActive !== false,
    kind: p.kind === 'service' ? 'service' : 'product',
  }
}

export function ProductFormDialog ({
  open,
  mode,
  productId,
  initialName,
  initialBlingId,
  defaultKind = 'product',
  onOpenChange,
  onSuccess,
  onNavigateToProductId,
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
  }, [open, mode, loadEdit, reloadKey])

  useEffect(() => {
    if (open) return
    setFormProduct(null)
    setLoadedProduct(null)
    setCompatibleModels([])
    setVariations([])
    setLoading(false)
    setLoadError(null)
    setSavePhase('idle')
  }, [open])

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
            salePrice: payload.salePrice,
            costPrice: payload.costPrice,
            isActive: payload.isActive,
            initialStock: payload.initialStock,
            pricingTagId: payload.pricingTagId,
            compatibleModelIds: payload.compatibleModelIds,
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          setSavePhase('idle')
          toast({
            title: 'Erro ao criar',
            description: String(data?.error || 'Tente novamente.'),
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
          salePrice: payload.salePrice,
          costPrice: payload.costPrice,
          isActive: payload.isActive,
          pricingTagId: payload.pricingTagId,
          compatibleModelIds: payload.compatibleModelIds,
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

  const title = mode === 'create'
    ? 'Novo produto/serviço'
    : 'Editar produto/serviço'

  const blingIdLabel = (() => {
    const b = loadedProduct?.blingId ?? initialBlingId
    if (b != null && String(b).trim()) return String(b)
    return '—'
  })()

  const showVariationsSection = Boolean(
    loadedProduct
    && !loadedProduct.parentBlingId
    && variations.length > 0
    && onNavigateToProductId,
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (savePhase !== 'idle') return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="flex max-h-[min(90vh,920px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Cadastro completo: preços, tag de precificação e modelos compatíveis.
          </DialogDescription>
          {mode === 'edit' && productId && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="text-muted-foreground/90">ID portal</span>
              {' '}
              <span className="font-mono tabular-nums text-foreground/70 select-all">
                {formProduct?.id ?? productId}
              </span>
              <span className="mx-1.5 text-muted-foreground/40" aria-hidden>
                ·
              </span>
              <span className="text-muted-foreground/90">Bling</span>
              {' '}
              <span className="font-mono tabular-nums text-foreground/70 select-all">
                {blingIdLabel}
              </span>
            </p>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {mode === 'edit' && loading && (
            <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando dados de {initialName || 'item'}...
            </div>
          )}

          {mode === 'edit' && loadError && (
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
          )}

          {mode === 'create' && (
            <ProductForm
              key="create"
              mode="create"
              defaultKind={defaultKind}
              embed
              initialCompatibleModels={[]}
              onCancel={() => onOpenChange(false)}
              onSubmit={handleSubmit}
            />
          )}

          {mode === 'edit' && !loading && !loadError && formProduct && (
            <>
              {savePhase !== 'idle' && (
                <div
                  className="mb-4 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground"
                  aria-live="polite"
                >
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  <span className="font-medium text-foreground">
                    {savePhase === 'saving' && 'Salvando…'}
                    {savePhase === 'syncing' && 'Sincronizando com o Bling…'}
                  </span>
                </div>
              )}

              <ProductForm
                key={`${formProduct.id}-${reloadKey}`}
                mode="edit"
                product={formProduct}
                initialCompatibleModels={compatibleModels}
                defaultKind={defaultKind}
                embed
                onCancel={() => onOpenChange(false)}
                onSubmit={handleSubmit}
              />

              {showVariationsSection && (
                <div className="mt-6 space-y-2 rounded-lg border border-border bg-muted/25 p-4">
                  <p className="text-sm font-medium text-foreground">
                    Variações
                    {' '}
                    <span className="font-normal text-muted-foreground">
                      ({variations.length})
                    </span>
                  </p>
                  <div className="max-h-52 overflow-auto rounded-md border border-border/60 bg-background">
                    <table className="w-full min-w-0 text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                          <th className="px-2 py-2 font-medium">Ordem</th>
                          <th className="px-2 py-2 font-medium">Nome</th>
                          <th className="px-2 py-2 font-medium">SKU</th>
                          <th className="px-2 py-2 text-right font-medium">Venda</th>
                          <th className="px-2 py-2 text-right font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {variations.map((v) => (
                          <tr key={v.id} className="border-b border-border/40 last:border-0">
                            <td className="px-2 py-2 font-mono text-xs text-muted-foreground tabular-nums">
                              {v.catalogSortKey ?? '—'}
                            </td>
                            <td className="max-w-[200px] truncate px-2 py-2 font-medium text-foreground">
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
                                disabled={savePhase !== 'idle'}
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
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
