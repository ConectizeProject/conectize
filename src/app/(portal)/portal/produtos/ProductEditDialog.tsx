'use client'

import { useCallback, useEffect, useState } from 'react'
import { Barcode, Loader2 } from 'lucide-react'
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

export function ProductEditDialog ({
  open,
  productId,
  initialName,
  onOpenChange,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [product, setProduct] = useState<ProductDetails | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
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
    setIsSaving(false)
    setIsSyncing(false)
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

    setIsSaving(true)

    try {
      const response = await fetch(`/api/portal/produtos/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: form.kind,
          name: normalizedName,
          sku: skuDirty ? (form.sku.trim() || null) : undefined,
          barcode: barcodeDirty ? (form.barcode.trim() || null) : undefined,
          description: form.description.trim() || null,
          salePrice,
          costPrice,
          isActive: form.isActive,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.ok) {
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

      toast({
        variant: 'success',
        title: data?.pendingSyncToBling ? 'Item salvo e marcado para sincronização.' : 'Item salvo com sucesso.',
      })

      onSuccess?.()
    } catch {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o item.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSyncToBling () {
    if (!productId) return

    setIsSyncing(true)

    try {
      const response = await fetch(`/api/portal/produtos/${productId}/sync-bling`, {
        method: 'POST',
      })
      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.ok) {
        toast({
          title: 'Erro ao sincronizar',
          description: data?.message || data?.error || 'Não foi possível enviar as alterações ao Bling.',
          variant: 'destructive',
        })
        return
      }

      const nextProduct = (data.product || null) as ProductDetails | null
      if (nextProduct) {
        setProduct(nextProduct)
        setForm(createFormState(nextProduct))
      }

      toast({
        variant: 'success',
        title: 'Alterações enviadas ao Bling.',
      })

      onSuccess?.()
    } catch {
      toast({
        title: 'Erro ao sincronizar',
        description: 'Não foi possível enviar as alterações ao Bling.',
        variant: 'destructive',
      })
    } finally {
      setIsSyncing(false)
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
        if (isSaving) return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar produto/serviço</DialogTitle>
          <DialogDescription>
            {product?.blingId
              ? 'As alterações serão salvas primeiro no portal. Depois você pode enviar manualmente para o Bling.'
              : 'As alterações serão salvas apenas no portal.'}
          </DialogDescription>
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
            {product?.blingId && (
              <div className={`rounded-md border p-3 text-sm ${product.blingSyncPending ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
                {product.blingSyncPending
                  ? 'Este item possui alterações locais pendentes de envio ao Bling.'
                  : 'Este item está sincronizado com o Bling.'}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-kind">Tipo</Label>
                <select
                  id="product-kind"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={form.kind}
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
                onCheckedChange={(checked) => {
                  setForm((currentForm) => currentForm ? { ...currentForm, isActive: checked === true } : currentForm)
                }}
              />
              <Label htmlFor="product-is-active">Item ativo</Label>
            </div>

            <DialogFooter>
              {product?.blingId && product.blingSyncPending && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSyncToBling}
                  disabled={isSaving || isSyncing}
                >
                  {isSyncing ? 'Enviando...' : 'Enviar atualizações para o Bling'}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving || isSyncing}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || isSyncing}>
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
