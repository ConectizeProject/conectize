'use client'

import Link from 'next/link'
import { memo, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Barcode, Copy, Loader2, MoreHorizontal, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { StockManagementModal } from './StockManagementModal'
import { cn } from '@/lib/utils'
import { ProductEditDialog } from './ProductEditDialog'

export type ProductRow = {
  id: string
  bling_id?: string | null
  bling_sync_pending?: boolean
  parent_bling_id?: string | null
  kind?: 'product' | 'service' | null
  name: string
  sku?: string | null
  barcode?: string | null
  image_url?: string | null
  sale_price_cents?: number | null
  cost_price_cents?: number | null
  is_active?: boolean
  created_at?: string
  current_stock?: number
  has_stock_movements?: boolean
  is_variation?: boolean
  parent_name?: string | null
}

type Props = {
  products: ProductRow[]
}

const allowedImageHosts = new Set<string>([
  'm.media-amazon.com',
  'http2.mlstatic.com',
  'elastobor.vtexassets.com',
  'nacionalsmart.com.br',
])

type QuickSalePriceCellProps = {
  productId: string
  blingId?: string | null
  salePriceCents?: number | null
}

const QuickSalePriceCell = memo(function QuickSalePriceCell ({
  productId,
  blingId,
  salePriceCents,
}: QuickSalePriceCellProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleSavePrice () {
    const numericValue = Number(String(value).replace(',', '.'))
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      toast({ description: 'Informe um valor válido', variant: 'destructive' })
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch(`/api/portal/produtos/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salePrice: numericValue }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast({
          description: data?.message || data?.error || 'Erro ao salvar preço',
          variant: 'destructive',
        })
        return
      }

      if (blingId) {
        const syncResponse = await fetch(`/api/portal/produtos/${productId}/sync-bling`, {
          method: 'POST',
        })
        const syncData = await syncResponse.json().catch(() => null)

        if (!syncResponse.ok || !syncData?.ok) {
          toast({
            title: 'Preço salvo no portal',
            description: syncData?.message || syncData?.error || 'Falha ao sincronizar com o Bling. O item ficou pendente de sincronização.',
            variant: 'destructive',
          })
          setIsEditing(false)
          setValue('')
          router.refresh()
          return
        }

        toast({
          title: 'Preço salvo e sincronizado com o Bling.',
          variant: 'success',
        })
      } else {
        toast({
          title: 'Preço salvo com sucesso.',
          variant: 'success',
        })
      }

      setIsEditing(false)
      setValue('')
      router.refresh()
    } catch {
      toast({ description: 'Erro ao salvar preço', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  if (isEditing) {
    return (
      <div
        className="flex items-center justify-end gap-1"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="number"
          step="0.01"
          min="0"
          className="h-8 w-24 rounded border border-input bg-background px-2 text-right text-xs"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          className="h-8 px-2 text-xs"
          disabled={isSaving}
          onClick={handleSavePrice}
        >
          {isSaving
            ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Salvando...
              </>
              )
            : 'OK'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-8 px-2 text-xs"
          disabled={isSaving}
          onClick={() => {
            setIsEditing(false)
            setValue('')
          }}
        >
          X
        </Button>
      </div>
    )
  }

  return (
    <div
      className="flex items-center justify-end gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      <span className="tabular-nums">
        {typeof salePriceCents === 'number'
          ? formatCurrency(salePriceCents / 100)
          : '-'}
      </span>
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
        onClick={() => {
          setIsEditing(true)
          setValue(
            typeof salePriceCents === 'number'
              ? (salePriceCents / 100).toFixed(2)
              : ''
          )
        }}
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  )
})

export function ProductsListClient ({ products }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [stockModalProduct, setStockModalProduct] = useState<{
    id: string
    name: string
    costPriceCents?: number | null
    currentStock: number
  } | null>(null)
  const [filterType, setFilterType] = useState<'product' | 'service'>('product')
  const [editingProduct, setEditingProduct] = useState<Pick<ProductRow, 'id' | 'name'> | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [barcodeGeneratingId, setBarcodeGeneratingId] = useState<string | null>(null)
  const [barcodeGeneratingStage, setBarcodeGeneratingStage] = useState<'updating' | 'syncing' | null>(null)
  const isProductTab = filterType === 'product'

  const rows = useMemo(
    () =>
      products.map((p) => ({
        ...p,
        is_active: p.is_active !== false,
      })),
    [products]
  )

  const filteredRows = useMemo(
    () => {
      if (rows.length === 0) return []

      if (filterType === 'service') {
        return rows.filter((row) => !row.is_variation && row.kind === 'service')
      }

      const parents = rows.filter((r) => !r.is_variation)
      const parentByBlingId = new Map<string, (typeof rows)[number]>()
      const parentById = new Map<string, (typeof rows)[number]>()

      for (const p of parents) {
        parentById.set(p.id, p)
        if (p.bling_id) parentByBlingId.set(p.bling_id, p)
      }

      return rows.filter((row) => {
        const parent = row.is_variation && row.parent_bling_id
          ? parentByBlingId.get(row.parent_bling_id) || null
          : !row.is_variation
            ? parentById.get(row.id) || null
            : null

        if (!parent) {
          // sem pai conhecido: filtra por kind direto
          const kind = row.kind
          return kind === 'product' || kind == null
        }

        const kind = parent.kind
        return kind === 'product' || kind == null
      })
    },
    [rows, filterType]
  )

  async function handleSyncFromBling (productId: string) {
    if (syncingId) return
    setSyncingId(productId)
    try {
      const res = await fetch('/api/portal/bling/sync-product', {
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
      toast({
        variant: 'success',
        title: 'Dados atualizados pelo Bling.',
      })
      router.refresh()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro na sincronização',
        description: 'Tente novamente.',
      })
    } finally {
      setSyncingId(null)
    }
  }

  async function handleGenerateBarcodeFromBling (productId: string) {
    if (barcodeGeneratingId) return
    setBarcodeGeneratingId(productId)
    setBarcodeGeneratingStage('updating')
    try {
      toast({
        variant: 'default',
        title: 'Atualizando',
        description: 'Gerando código de barras e salvando no portal...',
      })

      const res = await fetch(`/api/portal/produtos/${productId}/barcode-generate`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          variant: 'destructive',
          title: 'Erro ao gerar código de barras',
          description: data?.message || data?.error || 'Tente novamente.',
        })
        return
      }

      if (data?.shouldSyncToBling) {
        setBarcodeGeneratingStage('syncing')
        toast({
          variant: 'default',
          title: 'Sincronizando',
          description: 'Enviando alteração ao Bling...',
        })

        const syncRes = await fetch('/api/portal/bling/sync-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        })

        const syncData = await syncRes.json().catch(() => null)
        if (!syncRes.ok || !syncData?.ok) {
          toast({
            variant: 'destructive',
            title: 'Erro ao sincronizar',
            description: syncData?.message || syncData?.error || 'Tente novamente.',
          })
          return
        }
      }

      toast({
        variant: 'success',
        title: 'Finalizado',
        description: 'Código de barras gerado e sincronizado.',
      })
      router.refresh()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar código de barras',
        description: 'Tente novamente.',
      })
    } finally {
      setBarcodeGeneratingId(null)
      setBarcodeGeneratingStage(null)
    }
  }

  return (
    <>
      <nav className="mb-4 flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setFilterType('product')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            filterType === 'product'
              ? 'text-foreground border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground hover:border-muted'
          )}
        >
          Produtos
        </button>
        <button
          type="button"
          onClick={() => setFilterType('service')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            filterType === 'service'
              ? 'text-foreground border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground hover:border-muted'
          )}
        >
          Serviços
        </button>
      </nav>

      <Card>
        <CardContent>
          {filteredRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 pr-2 text-left font-medium">Nome</th>
                    <th className="py-2 px-2 text-left font-medium">SKU</th>
                    <th className="py-2 px-2 text-left font-medium">Código barras</th>
                    {isProductTab && (
                      <th className="py-2 px-2 text-right font-medium">Estoque</th>
                    )}
                    <th className="py-2 px-2 text-right font-medium">Preço venda</th>
                    {isProductTab && (
                      <th className="py-2 px-2 text-right font-medium">Custo</th>
                    )}
                    <th className="py-2 px-2 text-center font-medium">Origem</th>
                    <th className="py-2 pl-2 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((product) => (
                    <tr
                      key={product.id}
                      className={`border-b last:border-0 cursor-pointer hover:bg-muted/40 ${product.is_variation ? 'bg-muted/40' : ''}`}
                      onClick={() => setEditingProduct({ id: product.id, name: product.name })}
                    >
                      <td className="py-2 pr-2 align-top">
                        <div className={`flex items-start gap-3 ${product.is_variation ? 'pl-6 relative' : ''}`}>
                          {product.is_variation && (
                            <span className="absolute left-0 top-4 h-px w-5 bg-border" aria-hidden="true" />
                          )}
                          <div className="h-10 w-10 flex items-center justify-center rounded-md border border-border overflow-hidden bg-muted shrink-0">
                            {(() => {
                              const url = product.image_url
                              if (!url) {
                                return null
                              }
                              try {
                                const hostname = new URL(url).hostname
                                if (!allowedImageHosts.has(hostname)) {
                                  return null
                                }
                              } catch {
                                return null
                              }
                              return (
                                <Image
                                  src={url}
                                  alt={product.name}
                                  width={40}
                                  height={40}
                                  className="object-cover"
                                />
                              )
                            })() || (
                              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                {product.name?.slice(0, 2) || '?'}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="font-medium flex items-center gap-2">
                              <span className={`truncate ${product.is_active ? '' : 'line-through text-muted-foreground'}`}>
                                {product.name}
                              </span>
                              {product.is_variation && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                  Variação
                                </span>
                              )}
                              {!product.is_active && (
                                <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                  Inativo
                                </span>
                              )}
                              {product.bling_id && product.bling_sync_pending && (
                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                  Desincronizado
                                </span>
                              )}
                            </div>
                            {product.created_at && (
                              <span className="text-[11px] text-muted-foreground">
                                Criado em {new Date(product.created_at).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 align-top">
                        {product.sku ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator?.clipboard?.writeText(product.sku ?? '').then(() => {
                                toast({ description: 'Copiado para a área de transferência', duration: 2000 })
                              }).catch(() => {})
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-left font-mono bg-muted/70 hover:bg-muted border border-border/60 cursor-pointer transition-colors max-w-full min-w-0"
                            title="Clique para copiar"
                          >
                            <span className="truncate">{product.sku}</span>
                            <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2 px-2 align-top">
                        {product.barcode ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator?.clipboard?.writeText(product.barcode ?? '').then(() => {
                                toast({ description: 'Copiado para a área de transferência', duration: 2000 })
                              }).catch(() => {})
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-left font-mono bg-muted/70 hover:bg-muted border border-border/60 cursor-pointer transition-colors max-w-full min-w-0"
                            title="Clique para copiar"
                          >
                            <span className="truncate">{product.barcode}</span>
                            <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                          </button>
                        ) : (
                          product.bling_id
                            ? (
                              <button
                                type="button"
                                disabled={barcodeGeneratingId === product.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleGenerateBarcodeFromBling(product.id)
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-left font-mono bg-muted/70 hover:bg-muted border border-border/60 cursor-pointer transition-colors max-w-full min-w-0 disabled:opacity-60 disabled:cursor-not-allowed"
                                aria-label="Gerar código de barras"
                                title="Gerar código de barras"
                              >
                                {barcodeGeneratingId === product.id
                                  ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                  : <Barcode className="h-3 w-3 text-muted-foreground" />}
                                <span className="truncate">
                                  {barcodeGeneratingId === product.id
                                    ? barcodeGeneratingStage === 'syncing'
                                      ? 'Sincronizando...'
                                      : 'Atualizando...'
                                    : 'Gerar'}
                                </span>
                              </button>
                              )
                            : '-'
                        )}
                      </td>
                      {isProductTab && (
                        <td className="py-2 px-2 align-top text-right">
                          {product.has_stock_movements ? (
                            <button
                              type="button"
                              className="tabular-nums text-primary underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded px-1 -mx-1"
                              onClick={(e) => {
                                e.stopPropagation()
                                setStockModalProduct({
                                  id: product.id,
                                  name: product.name,
                                  costPriceCents: product.cost_price_cents,
                                  currentStock: typeof product.current_stock === 'number' ? product.current_stock : 0,
                                })
                              }}
                            >
                              {typeof product.current_stock === 'number' ? product.current_stock : 0}
                            </button>
                          ) : (
                            <span className="tabular-nums text-muted-foreground">-</span>
                          )}
                        </td>
                      )}
                      <td className="py-2 px-2 align-top text-right">
                        <QuickSalePriceCell
                          productId={product.id}
                          blingId={product.bling_id}
                          salePriceCents={product.sale_price_cents}
                        />
                      </td>
                      {isProductTab && (
                        <td className="py-2 px-2 align-top text-right">
                          {typeof product.cost_price_cents === 'number'
                            ? formatCurrency(product.cost_price_cents / 100)
                            : '-'}
                        </td>
                      )}
                      <td className="py-2 px-2 align-top text-center">
                        {product.bling_id ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
                              Bling
                            </span>
                            {product.bling_sync_pending && (
                              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                Pendente
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Manual
                          </span>
                        )}
                      </td>
                      <td className="py-2 pl-2 align-top text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Abrir ações</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/portal/produtos/${product.id}/editar`}>Editar</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/portal/produtos/${product.id}`}>Ver detalhes</Link>
                            </DropdownMenuItem>
                            {product.bling_id && (
                              <DropdownMenuItem
                                onClick={() => handleSyncFromBling(product.id)}
                                disabled={syncingId === product.id}
                              >
                                {syncingId === product.id ? 'Sincronizando...' : 'Atualizar pelo Bling'}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-sm text-muted-foreground">
              {filterType === 'product'
                ? 'Nenhum produto encontrado.'
                : 'Nenhum serviço encontrado.'}
            </div>
          )}
        </CardContent>
      </Card>

      {stockModalProduct && (
        <StockManagementModal
          open={!!stockModalProduct}
          onOpenChange={(open) => !open && setStockModalProduct(null)}
          productId={stockModalProduct.id}
          productName={stockModalProduct.name}
          costPriceCents={stockModalProduct.costPriceCents}
          initialStock={stockModalProduct.currentStock}
          onSuccess={() => router.refresh()}
        />
      )}

      <ProductEditDialog
        open={Boolean(editingProduct)}
        productId={editingProduct?.id ?? null}
        initialName={editingProduct?.name}
        onOpenChange={(open) => {
          if (!open) setEditingProduct(null)
        }}
        onSuccess={() => router.refresh()}
      />
    </>
  )
}

