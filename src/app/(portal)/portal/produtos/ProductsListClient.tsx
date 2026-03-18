'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Copy, MoreHorizontal, Pencil } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type ProductRow = {
  id: string
  bling_id?: string | null
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
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState<string>('')
  const [savingPrice, setSavingPrice] = useState(false)
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
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

  async function handleSavePrice (productId: string) {
    const value = Number(String(editingPriceValue).replace(',', '.'))
    if (!Number.isFinite(value) || value < 0) {
      toast({ description: 'Informe um valor válido', variant: 'destructive' })
      return
    }
    setSavingPrice(true)
    try {
      const res = await fetch(`/api/portal/produtos/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salePrice: value }),
      })
      if (!res.ok) {
        toast({ description: 'Erro ao salvar preço', variant: 'destructive' })
        return
      }
      setEditingPriceId(null)
      setEditingPriceValue('')
      router.refresh()
    } catch (err) {
      toast({ description: 'Erro ao salvar preço', variant: 'destructive' })
    } finally {
      setSavingPrice(false)
    }
  }

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
                      onClick={() => setEditProduct(product)}
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
                          '-'
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
                        {editingPriceId === product.id ? (
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="h-8 w-24 rounded border border-input bg-background px-2 text-right text-xs"
                              value={editingPriceValue}
                              onChange={(e) => setEditingPriceValue(e.target.value)}
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={savingPrice}
                              onClick={() => handleSavePrice(product.id)}
                            >
                              OK
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditingPriceId(null)
                                setEditingPriceValue('')
                              }}
                            >
                              X
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="tabular-nums">
                              {typeof product.sale_price_cents === 'number'
                                ? formatCurrency(product.sale_price_cents / 100)
                                : '-'}
                            </span>
                            <button
                              type="button"
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                              onClick={() => {
                                setEditingPriceId(product.id)
                                setEditingPriceValue(
                                  typeof product.sale_price_cents === 'number'
                                    ? (product.sale_price_cents / 100).toFixed(2)
                                    : ''
                                )
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        )}
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
                          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
                            Bling
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Manual
                          </span>
                        )}
                      </td>
                      <td className="py-2 pl-2 align-top text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
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

      {editProduct && (
        <Dialog open={!!editProduct} onOpenChange={(open) => !open && setEditProduct(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar produto/serviço</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Nome</div>
                <div className="font-medium">{editProduct.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Preço venda</div>
                <div className="font-medium">
                  {typeof editProduct.sale_price_cents === 'number'
                    ? formatCurrency(editProduct.sale_price_cents / 100)
                    : '-'}
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditProduct(null)}
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    router.push(`/portal/produtos/${editProduct.id}/editar`)
                  }}
                >
                  Abrir edição completa
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

