'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const PAGE_SIZE = 20

type Movement = {
  id: string
  productId: string
  type: 'entry' | 'exit' | 'loss' | 'balance'
  quantity: number
  unitValueCents: number
  totalValueCents: number
  source: string
  externalReference: string | null
  salesOrderId?: string | null
  salesOrderNumber?: number | null
  createdAt: string
}

type StockData = {
  currentStock: number
  movements: Movement[]
  total: number
  page: number
  pageSize: number
}

function originCell (m: Movement) {
  const ref = String(m.externalReference || '')
  if (m.source === 'sales_order' || m.salesOrderId) {
    const orderId = m.salesOrderId || (ref.startsWith('sales_order') ? ref.split(':')[1] : '')
    const numberLabel = typeof m.salesOrderNumber === 'number'
      ? String(m.salesOrderNumber)
      : null
    const label = numberLabel
      ? `Pedido nº ${numberLabel}`
      : 'Pedido de venda'
    if (orderId) {
      return (
        <Link
          href={`/portal/vendas/${orderId}`}
          className="text-primary underline-offset-2 hover:underline"
        >
          {label}
        </Link>
      )
    }
    return label
  }
  if (m.source === 'pdv_sale' && ref.startsWith('pdv_sale:')) {
    const saleId = ref.split(':')[1] || ''
    return `Venda PDV legado (${saleId.slice(0, 8)})`
  }
  if (m.source === 'service_order' && ref.startsWith('service_order:')) {
    const orderId = ref.split(':')[1] || ''
    return `OS (${orderId.slice(0, 8)})`
  }
  if (m.source === 'bling') return 'Bling'
  if (m.source === 'system') return 'Sistema'
  return 'Portal'
}

type Props = {
  productId: string
  productName: string
  costPriceCents?: number | null
  initialStock?: number
  /** Quando falso, não busca (ex.: aba inativa). */
  active?: boolean
  onSuccess?: () => void
}

export function ProductStockPanel ({
  productId,
  productName,
  costPriceCents,
  initialStock = 0,
  active = true,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [data, setData] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [type, setType] = useState<'entry' | 'exit' | 'loss' | 'balance'>('entry')
  const [quantity, setQuantity] = useState('1')
  const [unitValue, setUnitValue] = useState('')
  const [page, setPage] = useState(1)

  const fetchStock = useCallback(async (pageToLoad = 1) => {
    if (!productId || !active) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/portal/produtos/${productId}/estoque?page=${pageToLoad}&pageSize=${PAGE_SIZE}`,
      )
      if (res.ok) {
        const json = await res.json() as {
          currentStock?: number
          movements?: Movement[]
          total?: number
          page?: number
          pageSize?: number
        }
        setData({
          currentStock: json.currentStock ?? 0,
          movements: json.movements ?? [],
          total: json.total ?? 0,
          page: json.page ?? pageToLoad,
          pageSize: json.pageSize ?? PAGE_SIZE,
        })
        setPage(json.page ?? pageToLoad)
      } else {
        setData({ currentStock: initialStock, movements: [], total: 0, page: 1, pageSize: PAGE_SIZE })
      }
    } catch {
      setData({ currentStock: initialStock, movements: [], total: 0, page: 1, pageSize: PAGE_SIZE })
    } finally {
      setLoading(false)
    }
  }, [productId, initialStock, active])

  useEffect(() => {
    if (!active || !productId) return
    setPage(1)
    void fetchStock(1)
  }, [active, productId, fetchStock])

  useEffect(() => {
    const defaultCents = typeof costPriceCents === 'number' ? costPriceCents : 0
    if (active && defaultCents > 0 && unitValue === '') {
      setUnitValue((defaultCents / 100).toFixed(2))
    }
  }, [active, costPriceCents, unitValue])

  async function handleSubmit (e: React.FormEvent) {
    e.preventDefault()
    const qty = Number(quantity.replace(',', '.'))
    if (!Number.isFinite(qty)) {
      toast({
        variant: 'destructive',
        title: 'Quantidade inválida',
        description: 'Informe um número.',
      })
      return
    }
    if (type !== 'balance' && qty <= 0) {
      toast({
        variant: 'destructive',
        title: 'Quantidade inválida',
        description: 'Informe uma quantidade a partir de 1.',
      })
      return
    }
    if (type === 'balance' && qty < 0) {
      toast({
        variant: 'destructive',
        title: 'Saldo inválido',
        description: 'O balanço pode ser 0 ou mais.',
      })
      return
    }
    const uv = Number(String(unitValue || '0').replace(',', '.'))
    const unitValueCents = uv > 0 ? Math.round(uv * 100) : 0

    setSubmitting(true)
    try {
      const res = await fetch(`/api/portal/produtos/${productId}/estoque`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, quantity: qty, unitValueCents }),
      })
      if (res.ok) {
        const json = await res.json().catch(() => ({})) as {
          currentStock?: number
          movement?: unknown
          blingPushError?: string
        }
        if (json?.blingPushError) {
          toast({
            variant: 'destructive',
            title: 'Estoque atualizado no portal',
            description: `Não foi possível enviar ao Bling: ${json.blingPushError}`,
          })
        } else if (type === 'balance' && json?.movement === null) {
          toast({
            title: 'Balanço concluído',
            description: 'O saldo informado já era o estoque atual; nenhuma movimentação foi criada.',
          })
        } else {
          const successTitle =
            type === 'balance'
              ? 'Balanço registrado'
              : type === 'entry'
                ? 'Entrada registrada'
                : type === 'exit'
                  ? 'Saída registrada'
                  : 'Perda registrada'
          toast({ title: successTitle })
        }
        setQuantity('1')
        await fetchStock(1)
        onSuccess?.()
      } else {
        let description = 'Não foi possível salvar o movimento.'
        try {
          const errJson = await res.json() as { error?: string }
          const code = errJson?.error
          if (code === 'invalid_quantity') description = 'Quantidade inválida.'
          else if (code === 'invalid_type') description = 'Tipo de movimento inválido.'
          else if (code === 'product_not_found') description = 'Produto não encontrado.'
          else if (code === 'not_authenticated') description = 'Sessão expirada. Entre novamente.'
          else if (code === 'forbidden') description = 'Sem permissão para esta ação.'
          else if (typeof code === 'string') description = code
        } catch {
          // mantém mensagem padrão
        }
        toast({
          variant: 'destructive',
          title: 'Erro ao salvar',
          description,
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro de rede',
        description: 'Não foi possível conectar ao servidor.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const currentStock = data?.currentStock ?? initialStock
  const movements = data?.movements ?? []
  const total = data?.total ?? 0
  const pageSize = data?.pageSize ?? PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {productName}
      </p>
      <p className="text-sm">
        Estoque atual:{' '}
        <span className="font-semibold tabular-nums">{currentStock}</span>
        {' '}
        unidade(s)
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Registrar movimento</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="product-stock-type">Tipo</Label>
            <select
              id="product-stock-type"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={type}
              onChange={(e) => setType(e.target.value as 'entry' | 'exit' | 'loss' | 'balance')}
            >
              <option value="entry">Entrada</option>
              <option value="exit">Saída</option>
              <option value="loss">Perda</option>
              <option value="balance">Balanço</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-stock-qty">{type === 'balance' ? 'Saldo final' : 'Quantidade'}</Label>
            <Input
              id="product-stock-qty"
              type="number"
              inputMode="numeric"
              step={1}
              min={type === 'balance' ? 0 : 1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-stock-unit">Valor unit. (R$)</Label>
            <Input
              id="product-stock-unit"
              type="number"
              step="0.01"
              min={0}
              value={unitValue}
              onChange={(e) => setUnitValue(e.target.value)}
            />
          </div>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar movimento'}
        </Button>
      </form>

      <div>
        <p className="text-sm font-medium mb-2">Histórico</p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum movimento registrado.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="py-2 pr-2 text-left font-medium">Data</th>
                    <th className="py-2 px-2 text-left font-medium">Tipo</th>
                    <th className="py-2 px-2 text-right font-medium">Qtd</th>
                    <th className="py-2 px-2 text-right font-medium">Total</th>
                    <th className="py-2 pl-2 text-left font-medium">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        {m.createdAt
                          ? new Date(m.createdAt).toLocaleString('pt-BR')
                          : '-'}
                      </td>
                      <td className="py-2 px-2">
                        {m.type === 'entry'
                          ? 'Entrada'
                          : m.type === 'exit'
                            ? 'Saída'
                            : m.type === 'balance'
                              ? 'Balanço'
                              : 'Perda'}
                      </td>
                      <td className="py-2 px-2 text-right">{m.quantity}</td>
                      <td className="py-2 px-2 text-right">
                        {m.totalValueCents ? formatCurrency(m.totalValueCents / 100) : '-'}
                      </td>
                      <td className="py-2 pl-2">
                        {originCell(m)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {total} movimento(s)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const next = Math.max(1, page - 1)
                      setPage(next)
                      void fetchStock(next)
                    }}
                    disabled={page <= 1 || loading}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm tabular-nums">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const next = Math.min(totalPages, page + 1)
                      setPage(next)
                      void fetchStock(next)
                    }}
                    disabled={page >= totalPages || loading}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
