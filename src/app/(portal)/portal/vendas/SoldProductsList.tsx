'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import { toast } from '@/hooks/use-toast'
import { VendasListPagination } from '@/app/(portal)/portal/vendas/VendasListPagination'
import { VENDAS_LIST_PAGE_SIZE } from '@/lib/vendas/list-pagination'
import { isSafeProductListImageUrl } from '@/app/(portal)/portal/produtos/product-list-shared'
import { ProductEditDialog } from '@/app/(portal)/portal/produtos/ProductEditDialog'
import {
  SoldItemMarginBreakdown,
  type SoldItemMarginBreakdownData,
} from '@/app/(portal)/portal/vendas/SoldItemMarginBreakdown'

type SoldItem = {
  id: string
  productId: string | null
  productName: string
  productSku: string | null
  productImageUrl: string | null
  quantity: number
  unitPriceCents: number
  lineUnitCostCents: number
  productCostCents: number | null
  subtotalCents: number
  createdAt: string
  order: {
    id: string
    orderNumber: number
    createdAt: string
    totalCents: number
    mlOrderId: string | null
    mlPackId: string | null
    customerName: string | null
  }
  margin: SoldItemMarginBreakdownData & {
    effectiveUnitCostCents: number | null
  }
}

export function SoldProductsList () {
  const router = useRouter()
  const pathname = usePathname() || '/portal/vendas/produtos'
  const searchParams = useSearchParams()
  const page = Math.max(1, Number.parseInt(String(searchParams.get('page') || '1'), 10) || 1)

  const [items, setItems] = useState<SoldItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState<SoldItem | null>(null)
  const [costMasked, setCostMasked] = useState('')
  const [costScope, setCostScope] = useState<'sale' | 'sale_and_product'>('sale')
  const [savingCost, setSavingCost] = useState(false)
  const [editingProduct, setEditingProduct] = useState<{
    id: string
    name: string
  } | null>(null)

  const load = useCallback(async (pageNum: number) => {
    setLoading(true)
    try {
      const res = await portalFetch(
        `/api/portal/sales-orders/sold-items?page=${encodeURIComponent(String(pageNum))}`,
      )
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Não foi possível carregar os produtos vendidos.')
      }
      setItems(Array.isArray(data.items) ? (data.items as SoldItem[]) : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } catch (err) {
      setItems([])
      setTotal(0)
      toast({
        title: 'Erro ao carregar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(page)
  }, [load, page])

  function setPage (next: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (next <= 1) params.delete('page')
    else params.set('page', String(next))
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  function openCostEditor (item: SoldItem) {
    if (!item.margin.canEditCost) return
    const initial =
      item.margin.effectiveUnitCostCents != null
        ? item.margin.effectiveUnitCostCents
        : item.productCostCents && item.productCostCents > 0
          ? item.productCostCents
          : 0
    setCostMasked(maskedFromCents(initial))
    setCostScope('sale')
    setEditItem(item)
  }

  async function saveCost () {
    if (!editItem) return
    const parsed = moneyToCentsFromMasked(costMasked)
    if (parsed == null) {
      toast({
        title: 'Custo inválido',
        description: 'Informe um valor em reais no formato 0,00.',
        variant: 'destructive',
      })
      return
    }
    setSavingCost(true)
    try {
      const res = await portalFetch(
        `/api/portal/sales-orders/sold-items/${encodeURIComponent(editItem.id)}/cost`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unitCostCents: parsed,
            scope: costScope,
          }),
        },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Não foi possível atualizar o custo.')
      }
      const nextMargin = data.margin as SoldItem['margin']
      setItems((prev) =>
        prev.map((row) => {
          if (row.id !== editItem.id) return row
          return {
            ...row,
            lineUnitCostCents: parsed,
            productCostCents:
              costScope === 'sale_and_product' ? parsed : row.productCostCents,
            margin: nextMargin,
          }
        }),
      )
      setEditItem(null)
      toast({
        title: 'Custo atualizado',
        description:
          costScope === 'sale_and_product'
            ? 'Atualizado na venda e no cadastro do produto.'
            : 'Atualizado somente nesta venda.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao salvar custo',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingCost(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base font-semibold'>Últimos produtos vendidos</CardTitle>
          <p className='text-sm text-muted-foreground'>
            Itens de pedidos pagos, com lucro bruto e margem de contribuição (frete, tarifas e imposto quando houver NFC/NF).
          </p>
        </CardHeader>
        <CardContent className='space-y-3 p-0 sm:p-0'>
          {loading ? (
            <p className='px-4 py-8 text-sm text-muted-foreground'>Carregando…</p>
          ) : items.length === 0 ? (
            <p className='px-4 py-8 text-sm text-muted-foreground'>
              Nenhum produto vendido encontrado.
            </p>
          ) : (
            <ul className='divide-y divide-border'>
              {items.map((item) => {
                const orderHref = item.order.id
                  ? `/portal/vendas/${encodeURIComponent(item.order.id)}`
                  : null
                const orderDate = item.order.createdAt
                  ? new Date(item.order.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  : null

                return (
                  <li
                    key={item.id}
                    className='grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(160px,0.55fr)] lg:items-center'
                  >
                    <div className='flex min-w-0 gap-3'>
                      <span className='inline-flex h-7 shrink-0 items-center justify-center rounded-md bg-amber-500/15 px-2 text-xs font-semibold tabular-nums text-amber-800 dark:text-amber-300'>
                        {item.quantity}x
                      </span>
                      <div className='flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30'>
                        {item.productImageUrl &&
                        isSafeProductListImageUrl(item.productImageUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.productImageUrl}
                            alt=""
                            width={48}
                            height={48}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className='text-[10px] font-medium uppercase text-muted-foreground'>
                            {item.productName.slice(0, 2) || '?'}
                          </span>
                        )}
                      </div>
                      <div className='min-w-0 space-y-1'>
                        {item.productId ? (
                          <button
                            type='button'
                            className='block w-full truncate text-left text-sm font-semibold text-foreground hover:text-primary hover:underline'
                            onClick={() => {
                              setEditingProduct({
                                id: item.productId!,
                                name: item.productName,
                              })
                            }}
                          >
                            {item.productName}
                          </button>
                        ) : (
                          <p className='truncate text-sm font-semibold text-foreground'>
                            {item.productName}
                          </p>
                        )}
                        <div className='flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground'>
                          {item.productSku ? (
                            <span className='font-mono tabular-nums'>SKU {item.productSku}</span>
                          ) : null}
                          <span className='tabular-nums text-red-600 dark:text-red-400'>
                            {maskedFromCents(item.unitPriceCents)}
                          </span>
                        </div>
                        {item.order.customerName ? (
                          <p className='truncate text-xs text-muted-foreground'>
                            {item.order.customerName}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className='min-w-0 space-y-1 text-sm'>
                      {orderHref ? (
                        <Link
                          href={orderHref}
                          className='font-medium text-primary hover:underline'
                        >
                          Pedido #{item.order.orderNumber}
                        </Link>
                      ) : (
                        <span className='font-medium'>Pedido #{item.order.orderNumber}</span>
                      )}
                      {item.order.mlPackId ? (
                        <p className='text-xs text-muted-foreground'>
                          Carrinho{' '}
                          <span className='font-mono tabular-nums text-foreground/80'>
                            #{item.order.mlPackId}
                          </span>
                        </p>
                      ) : null}
                      {item.order.mlOrderId && !item.order.mlPackId ? (
                        <p className='text-xs text-muted-foreground'>
                          ML{' '}
                          <span className='font-mono tabular-nums text-foreground/80'>
                            #{item.order.mlOrderId}
                          </span>
                        </p>
                      ) : null}
                      {orderDate ? (
                        <p className='text-xs text-muted-foreground'>Data: {orderDate}</p>
                      ) : null}
                    </div>

                    <div className='flex justify-end lg:justify-end'>
                      <SoldItemMarginBreakdown
                        margin={item.margin}
                        quantity={item.quantity}
                        onEditCost={
                          item.margin.canEditCost
                            ? () => openCostEditor(item)
                            : undefined
                        }
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <VendasListPagination
            page={page}
            pageSize={VENDAS_LIST_PAGE_SIZE}
            total={total}
            disabled={loading}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editItem)}
        onOpenChange={(open) => {
          if (!open && !savingCost) setEditItem(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar custo</DialogTitle>
            <DialogDescription>
              {editItem
                ? `Defina o custo unitário de «${editItem.productName}».`
                : 'Defina o custo unitário.'}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='sold-item-cost'>Custo unitário (R$)</Label>
              <Input
                id='sold-item-cost'
                inputMode='decimal'
                value={costMasked}
                onChange={(e) => setCostMasked(formatMoneyInput(e.target.value))}
                disabled={savingCost}
                autoComplete='off'
              />
            </div>
            <RadioGroup
              value={costScope}
              onValueChange={(v) => {
                if (v === 'sale' || v === 'sale_and_product') setCostScope(v)
              }}
              disabled={savingCost}
              className='gap-3'
            >
              <label className='flex cursor-pointer items-start gap-2 text-sm'>
                <RadioGroupItem value='sale' id='cost-scope-sale' className='mt-0.5' />
                <span>
                  <span className='font-medium'>Só esta venda</span>
                  <span className='mt-0.5 block text-xs text-muted-foreground'>
                    Atualiza o custo apenas nesta linha do pedido.
                  </span>
                </span>
              </label>
              <label className='flex cursor-pointer items-start gap-2 text-sm'>
                <RadioGroupItem
                  value='sale_and_product'
                  id='cost-scope-both'
                  className='mt-0.5'
                />
                <span>
                  <span className='font-medium'>Venda e produto</span>
                  <span className='mt-0.5 block text-xs text-muted-foreground'>
                    Atualiza esta venda e o custo no cadastro do produto.
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              disabled={savingCost}
              onClick={() => setEditItem(null)}
            >
              Cancelar
            </Button>
            <Button type='button' disabled={savingCost} onClick={() => void saveCost()}>
              {savingCost ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductEditDialog
        open={Boolean(editingProduct)}
        mode='edit'
        productId={editingProduct?.id ?? null}
        initialName={editingProduct?.name}
        onOpenChange={(open) => {
          if (!open) setEditingProduct(null)
        }}
        onSuccess={() => {
          void load(page)
        }}
        onNavigateToProductId={(id) => {
          setEditingProduct({ id, name: '' })
        }}
      />
    </>
  )
}
