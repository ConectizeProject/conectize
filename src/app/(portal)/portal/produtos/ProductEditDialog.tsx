'use client'

import { useCallback, useEffect, useState } from 'react'
import { Barcode, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

type ProductKind = 'product' | 'service'

type ProductDetails = {
  id: string
  blingId: string | null
  blingSyncPending: boolean
  kind: ProductKind | null
  name: string
  sku: string | null
  barcode: string | null
  description: string | null
  salePriceCents: number | null
  costPriceCents: number | null
  isActive: boolean
}

type FormState = {
  kind: ProductKind
  name: string
  sku: string
  barcode: string
  description: string
  salePrice: string
  costPrice: string
  isActive: boolean
}

type Props = {
  open: boolean
  productId: string | null
  initialName?: string
  /** ID no Bling vindo da lista (exibido já ao abrir, antes do GET). */
  initialBlingId?: string | null
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

function formatMoneyInput (valueInCents: number | null) {
  if (typeof valueInCents !== 'number') return ''
  return (valueInCents / 100).toFixed(2)
}

function createFormState (product: ProductDetails): FormState {
  return {
    kind: product.kind === 'service' ? 'service' : 'product',
    name: product.name || '',
    sku: product.sku || '',
    barcode: product.barcode || '',
    description: product.description || '',
    salePrice: formatMoneyInput(product.salePriceCents),
    costPrice: formatMoneyInput(product.costPriceCents),
    isActive: product.isActive !== false,
  }
}

function parseMoneyValue (value: string) {
  const normalizedValue = value.replace(',', '.').trim()
  if (!normalizedValue) return null

  const numericValue = Number(normalizedValue)
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return Number.NaN
  }

  return numericValue
}

function calculateEAN13Checksum (code12: string) {
  let sum = 0
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(code12[i])
    sum += i % 2 === 0 ? digit : digit * 3
  }

  return (10 - (sum % 10)) % 10
}

function generateEAN13 () {
  const prefix = '761'
  const randomNineDigits = Math.floor(100000000 + Math.random() * 900000000)
  const baseCode = `${prefix}${randomNineDigits.toString()}`
  const checksum = calculateEAN13Checksum(baseCode)
  return `${baseCode}${checksum}`
}

type SavePhase = 'idle' | 'saving' | 'syncing' | 'finished'

const SAVE_FINISHED_MS = 900

export function ProductEditDialog ({
  open,
  productId,
  initialName,
  initialBlingId,
  onOpenChange,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [product, setProduct] = useState<ProductDetails | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [savePhase, setSavePhase] = useState<SavePhase>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [skuDirty, setSkuDirty] = useState(false)
  const [barcodeDirty, setBarcodeDirty] = useState(false)

  useEffect(() => {
    if (!open || !productId) return

    let isMounted = true

    async function loadProduct () {
      setIsLoading(true)
      setLoadError(null)

      try {
        const response = await fetch(`/api/portal/produtos/${productId}`)
        const data = await response.json().catch(() => null)

        if (!response.ok || !data?.ok || !data?.product) {
          throw new Error(data?.message || data?.error || 'Não foi possível carregar o item.')
        }

        if (!isMounted) return

        setProduct(data.product as ProductDetails)
        setForm(createFormState(data.product as ProductDetails))
        setSkuDirty(false)
        setBarcodeDirty(false)
      } catch (err) {
        if (!isMounted) return

        const message = err instanceof Error ? err.message : 'Não foi possível carregar o item.'
        setLoadError(message)
        setProduct(null)
        setForm(null)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadProduct()

    return () => {
      isMounted = false
    }
  }, [open, productId, reloadKey])

  useEffect(() => {
    if (open) return

    setProduct(null)
    setForm(null)
    setIsLoading(false)
    setSavePhase('idle')
    setLoadError(null)
    setSkuDirty(false)
    setBarcodeDirty(false)
  }, [open])

  async function handleSubmit (event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!productId || !form) return

    const salePrice = parseMoneyValue(form.salePrice)
    if (Number.isNaN(salePrice)) {
      toast({ description: 'Informe um preço de venda válido.', variant: 'destructive' })
      return
    }

    const costPrice = parseMoneyValue(form.costPrice)
    if (Number.isNaN(costPrice)) {
      toast({ description: 'Informe um custo válido.', variant: 'destructive' })
      return
    }

    const normalizedName = form.name.trim()
    if (!normalizedName) {
      toast({ description: 'Informe o nome do item.', variant: 'destructive' })
      return
    }

    setSavePhase('saving')

    try {
      const payload: Record<string, unknown> = {
        kind: form.kind,
        name: normalizedName,
        description: form.description.trim() || null,
        salePrice,
        isActive: form.isActive,
      }
      if (skuDirty) payload.sku = form.sku.trim() || null
      if (barcodeDirty) payload.barcode = form.barcode.trim() || null
      if (costPrice !== null) payload.costPrice = costPrice

      const response = await fetch(`/api/portal/produtos/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.ok) {
        setSavePhase('idle')
        toast({
          title: 'Erro ao salvar',
          description: data?.message || data?.error || 'Não foi possível salvar o item.',
          variant: 'destructive',
        })
        return
      }

      const nextProduct = (data.product || null) as ProductDetails | null
      if (nextProduct) {
        setProduct(nextProduct)
        setForm(createFormState(nextProduct))
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
            description: syncData?.message || syncData?.error || 'O item foi salvo no portal, mas não foi possível enviar ao Bling.',
            variant: 'destructive',
          })
          onSuccess?.()
          return
        }

        const syncedProduct = (syncData.product || null) as ProductDetails | null
        if (syncedProduct) {
          setProduct(syncedProduct)
          setForm(createFormState(syncedProduct))
        }
      }

      setSavePhase('finished')
      await new Promise((resolve) => {
        setTimeout(resolve, SAVE_FINISHED_MS)
      })
      setSavePhase('idle')
      onSuccess?.()
    } catch {
      setSavePhase('idle')
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o item.',
        variant: 'destructive',
      })
    }
  }

  const handleGenerateBarcode = useCallback(() => {
    setForm((currentForm) => {
      if (!currentForm) return currentForm
      return { ...currentForm, barcode: generateEAN13() }
    })

    setBarcodeDirty(true)
    toast({ description: 'Código de barras gerado.' })
  }, [toast])

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (savePhase !== 'idle') return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar produto/serviço</DialogTitle>
          <DialogDescription className="sr-only">
            Edite nome, tipo, SKU, código de barras, preços e demais dados do item no portal.
          </DialogDescription>
          {productId && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="text-muted-foreground/90">ID portal</span>{' '}
              <span className="font-mono tabular-nums text-foreground/70 select-all">
                {product?.id ?? productId}
              </span>
              <span className="mx-1.5 text-muted-foreground/40" aria-hidden>
                ·
              </span>
              <span className="text-muted-foreground/90">Bling</span>{' '}
              <span className="font-mono tabular-nums text-foreground/70 select-all">
                {(() => {
                  const fromApi = product?.blingId != null && String(product.blingId).trim()
                    ? String(product.blingId)
                    : ''
                  if (fromApi) return fromApi
                  const fromRow = initialBlingId != null && String(initialBlingId).trim()
                    ? String(initialBlingId)
                    : ''
                  return fromRow || '—'
                })()}
              </span>
            </p>
          )}
        </DialogHeader>

        {isLoading && (
          <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando dados de {initialName || 'item'}...
          </div>
        )}

        {!isLoading && loadError && (
          <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">{loadError}</p>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReloadKey((currentValue) => currentValue + 1)}
              >
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !loadError && form && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {savePhase !== 'idle' && (
              <div
                className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground"
                aria-live="polite"
              >
                {savePhase === 'finished' ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                ) : (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                )}
                <span className="font-medium text-foreground">
                  {savePhase === 'saving' && 'Salvando…'}
                  {savePhase === 'syncing' && 'Sincronizando com o Bling…'}
                  {savePhase === 'finished' && 'Finalizado'}
                </span>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-kind">Tipo</Label>
                <select
                  id="product-kind"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={form.kind}
                  disabled={savePhase !== 'idle'}
                  onChange={(event) => {
                    const kind = event.target.value === 'service' ? 'service' : 'product'
                    setForm((currentForm) => currentForm ? { ...currentForm, kind } : currentForm)
                  }}
                >
                  <option value="product">Produto</option>
                  <option value="service">Serviço</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-name">Nome *</Label>
                <Input
                  id="product-name"
                  value={form.name}
                  disabled={savePhase !== 'idle'}
                  onChange={(event) => {
                    setForm((currentForm) => currentForm ? { ...currentForm, name: event.target.value } : currentForm)
                  }}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-sku">SKU</Label>
                <Input
                  id="product-sku"
                  value={form.sku}
                  disabled={savePhase !== 'idle'}
                  onChange={(event) => {
                    setSkuDirty(true)
                    setForm((currentForm) => currentForm ? { ...currentForm, sku: event.target.value } : currentForm)
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-barcode">Código de barras</Label>
                <div className="relative">
                  <Input
                    id="product-barcode"
                    className="pr-10"
                    value={form.barcode}
                    disabled={savePhase !== 'idle'}
                    onChange={(event) => {
                      setBarcodeDirty(true)
                      setForm((currentForm) => currentForm ? { ...currentForm, barcode: event.target.value } : currentForm)
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                    onClick={handleGenerateBarcode}
                    disabled={savePhase !== 'idle'}
                    aria-label="Gerar código de barras (EAN-13)"
                  >
                    <Barcode className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-description">Descrição</Label>
              <Textarea
                id="product-description"
                value={form.description}
                disabled={savePhase !== 'idle'}
                onChange={(event) => {
                  setForm((currentForm) => currentForm ? { ...currentForm, description: event.target.value } : currentForm)
                }}
                rows={5}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-sale-price">Preço de venda (R$)</Label>
                <Input
                  id="product-sale-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.salePrice}
                  disabled={savePhase !== 'idle'}
                  onChange={(event) => {
                    setForm((currentForm) => currentForm ? { ...currentForm, salePrice: event.target.value } : currentForm)
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-cost-price">Custo (R$)</Label>
                <Input
                  id="product-cost-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.costPrice}
                  disabled={savePhase !== 'idle'}
                  onChange={(event) => {
                    setForm((currentForm) => currentForm ? { ...currentForm, costPrice: event.target.value } : currentForm)
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="product-is-active"
                checked={form.isActive}
                disabled={savePhase !== 'idle'}
                onCheckedChange={(checked) => {
                  setForm((currentForm) => currentForm ? { ...currentForm, isActive: checked === true } : currentForm)
                }}
              />
              <Label htmlFor="product-is-active">Item ativo</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={savePhase !== 'idle'}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savePhase !== 'idle'}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
