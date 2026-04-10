import { redirect, notFound } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { getPortalAuth } from '@/lib/supabase/server'
import {
  getProductWithStock,
  getProductById,
  getProductCurrentStock,
  listStockMovements,
  addStockMovement,
  type StockMovementType,
} from '@/lib/products/service'
import { pushStockMovementToBling } from '@/lib/integrations/bling/push-stock-movement'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import { ProductDetailActions } from './ProductDetailActions'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export default async function ProdutoDetalhePage ({ params }: { params: Params }) {
  const { id } = await params
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) redirect('/portal/minhas-ordens')

  const productRes = await getProductWithStock(id)
  if (!productRes.ok || !('product' in productRes)) notFound()

  const movementsRes = await listStockMovements(id)
  const movements = movementsRes.ok && 'items' in movementsRes ? movementsRes.items : []

  async function registerMovement (formData: FormData) {
    'use server'

    const type = String(formData.get('type') || '').trim() as StockMovementType | 'balance'
    const quantity = Number(String(formData.get('quantity') || '0').replace(',', '.')) || 0
    const unitValue = Number(String(formData.get('unitValue') || '0').replace(',', '.')) || 0

    const unitValueCents = unitValue > 0 ? Math.round(unitValue * 100) : 0
    const productSource = product.blingId ? 'bling' : 'manual'

    if (type === 'balance') {
      const localBalanceRes = await getProductCurrentStock(id)
      const localBalance = localBalanceRes.ok && 'currentStock' in localBalanceRes ? localBalanceRes.currentStock : 0
      const target = quantity
      const diff = target - localBalance

      if (diff !== 0) {
        const movementType: StockMovementType = diff > 0 ? 'entry' : 'exit'
        await addStockMovement(id, {
          type: movementType,
          quantity: Math.abs(diff),
          unitValueCents,
          source: productSource,
        })
      }

      try {
        const productRes = await getProductById(id)
        if (productRes.ok && 'product' in productRes && productRes.product.blingId) {
          await pushStockMovementToBling({
            productBlingId: productRes.product.blingId,
            type,
            quantity: target,
            unitValueCents,
            observacoes: 'Balanço (portal)',
          })
        }
      } catch {
        // Melhor esforço
      }
    } else {
      await addStockMovement(id, {
        type,
        quantity,
        unitValueCents,
        source: productSource,
      })

      try {
        const productRes = await getProductById(id)
        if (productRes.ok && 'product' in productRes && productRes.product.blingId) {
          const pushType = type === 'loss' ? 'exit' : type
          await pushStockMovementToBling({
            productBlingId: productRes.product.blingId,
            type: pushType,
            quantity,
            unitValueCents,
            observacoes: type === 'loss' ? 'Perda (portal)' : undefined,
          })
        }
      } catch {
        // Melhor esforço: o estoque local já foi registrado
      }
    }

    redirect(`/portal/produtos/${id}`)
  }

  const product = productRes.product
  const currentStock = productRes.currentStock ?? 0

  const lastEntryCostCents = movements
    .filter((m) => m.type === 'entry' && typeof m.unitValueCents === 'number' && m.unitValueCents > 0)
    .sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return db - da
    })[0]?.unitValueCents

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="text-sm text-muted-foreground">
            Estoque atual: <span className="font-semibold">{currentStock}</span> unidade(s)
          </p>
        </div>

        <ProductDetailActions productId={id} hasBling={Boolean(product.blingId)} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Dados do produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-medium">SKU:</span> {product.sku || '-'}</p>
            <p><span className="font-medium">Código de barras:</span> {product.barcode || '-'}</p>
            <p>
              <span className="font-medium">Preço venda:</span>{' '}
              {typeof product.salePriceCents === 'number'
                ? formatCurrency(product.salePriceCents / 100)
                : '-'}
            </p>
            <p>
              <span className="font-medium">Custo (última entrada):</span>{' '}
              {typeof lastEntryCostCents === 'number'
                ? formatCurrency(lastEntryCostCents / 100)
                : '-'}
            </p>
            <p>
              <span className="font-medium">Status:</span>{' '}
              {product.isActive ? 'Ativo' : 'Inativo'}
            </p>
            <p>
              <span className="font-medium">Origem:</span>{' '}
              {product.blingId ? `Bling (#${product.blingId})` : 'Manual'}
            </p>
            {product.description && (
              <p className="pt-2 text-muted-foreground">{product.description}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registrar movimento</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={registerMovement}
              className="space-y-3"
            >
              <div className="space-y-1">
                <Label htmlFor="type">Tipo</Label>
                <select
                  id="type"
                  name="type"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  defaultValue="entry"
                >
                  <option value="entry">Entrada</option>
                  <option value="exit">Saída</option>
                  <option value="loss">Perda</option>
                  <option value="balance">Balanço</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="quantity">Quantidade</Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="0"
                  defaultValue="1"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="unitValue">Valor unitário (R$)</Label>
                <Input
                  id="unitValue"
                  name="unitValue"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={
                    typeof product.costPriceCents === 'number'
                      ? (product.costPriceCents / 100).toFixed(2)
                      : ''
                  }
                />
              </div>
              <Button type="submit" className="w-full">
                Salvar movimento
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de estoque</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhum movimento de estoque registrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 pr-2 text-left font-medium">Data</th>
                    <th className="py-2 px-2 text-left font-medium">Tipo</th>
                    <th className="py-2 px-2 text-right font-medium">Quantidade</th>
                    <th className="py-2 px-2 text-right font-medium">Valor unitário</th>
                    <th className="py-2 px-2 text-right font-medium">Valor total</th>
                    <th className="py-2 pl-2 text-left font-medium">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 align-top">
                        {m.createdAt
                          ? new Date(m.createdAt).toLocaleString('pt-BR')
                          : '-'}
                      </td>
                      <td className="py-2 px-2 align-top">
                        {m.type === 'entry' ? 'Entrada' : m.type === 'exit' ? 'Saída' : 'Perda'}
                      </td>
                      <td className="py-2 px-2 align-top text-right">{m.quantity}</td>
                      <td className="py-2 px-2 align-top text-right">
                        {m.unitValueCents
                          ? formatCurrency(m.unitValueCents / 100)
                          : '-'}
                      </td>
                      <td className="py-2 px-2 align-top text-right">
                        {m.totalValueCents
                          ? formatCurrency(m.totalValueCents / 100)
                          : '-'}
                      </td>
                      <td className="py-2 pl-2 align-top">
                        {m.source === 'bling'
                          ? 'Bling'
                          : m.source === 'system'
                            ? 'Sistema'
                            : 'Manual'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

