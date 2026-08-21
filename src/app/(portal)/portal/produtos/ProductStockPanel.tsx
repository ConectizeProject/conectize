'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleAlert,
  History,
  Loader2,
  Package,
  Scale,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { appConfirm } from '@/lib/ui/app-dialogs'
import { getOrdemPortalPath } from '@/lib/orders/ordem-portal-path'

const PAGE_SIZE = 20

type MovementType = 'entry' | 'exit' | 'loss' | 'balance'

type Movement = {
  id: string
  productId: string
  type: MovementType
  quantity: number
  unitValueCents: number
  totalValueCents: number
  source: string
  externalReference: string | null
  salesOrderId?: string | null
  salesOrderNumber?: number | null
  serviceOrderId?: string | null
  serviceOrderNumber?: number | null
  createdAt: string
}

type StockData = {
  currentStock: number
  movements: Movement[]
  total: number
  page: number
  pageSize: number
}

const MOVEMENT_TYPE_OPTIONS: Array<{
  value: MovementType
  label: string
  hint: string
}> = [
  { value: 'entry', label: 'Entrada', hint: 'Soma ao saldo' },
  { value: 'exit', label: 'Saída', hint: 'Baixa do saldo' },
  { value: 'loss', label: 'Perda', hint: 'Baixa por perda' },
  { value: 'balance', label: 'Balanço', hint: 'Define o saldo final' },
]

function movementTypeLabel (type: MovementType) {
  if (type === 'entry') return 'Entrada'
  if (type === 'exit') return 'Saída'
  if (type === 'balance') return 'Balanço'
  return 'Perda'
}

function movementTypeBadgeClass (type: MovementType) {
  if (type === 'entry') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
  }
  if (type === 'exit') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-400'
  }
  if (type === 'loss') {
    return 'border-destructive/25 bg-destructive/10 text-destructive'
  }
  return 'border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-400'
}

function quantityDisplay (m: Movement) {
  if (m.type === 'entry') return `+${m.quantity}`
  if (m.type === 'exit' || m.type === 'loss') return `−${m.quantity}`
  return String(m.quantity)
}

function quantityClass (type: MovementType) {
  if (type === 'entry') return 'text-emerald-700 dark:text-emerald-400'
  if (type === 'exit' || type === 'loss') return 'text-destructive'
  return 'text-foreground'
}

function formatMovementDate (iso: string) {
  if (!iso) return { date: '—', time: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '—', time: '' }
  return {
    date: d.toLocaleDateString('pt-BR'),
    time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  }
}

function StockSection ({
  title,
  description,
  children,
  action,
}: {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-border/80 bg-card text-card-foreground">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {description ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
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
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {label}
        </Link>
      )
    }
    return <span className="text-muted-foreground">{label}</span>
  }
  if (m.source === 'pdv_sale' && ref.startsWith('pdv_sale:')) {
    const saleId = ref.split(':')[1] || ''
    return (
      <span className="text-muted-foreground">
        Venda PDV legado ({saleId.slice(0, 8)})
      </span>
    )
  }
  if (m.source === 'service_order' || m.serviceOrderId) {
    const orderId = m.serviceOrderId || (ref.startsWith('service_order:') ? ref.split(':')[1] : '')
    const numberLabel = typeof m.serviceOrderNumber === 'number'
      ? m.serviceOrderNumber
      : null
    const label = numberLabel != null
      ? `OS #${numberLabel}`
      : 'Ordem de serviço'
    if (orderId) {
      return (
        <Link
          href={getOrdemPortalPath({ id: orderId, display_number: numberLabel })}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {label}
        </Link>
      )
    }
    return <span className="text-muted-foreground">{label}</span>
  }
  if (m.source === 'bling') return <span className="text-muted-foreground">Bling</span>
  if (m.source === 'system') return <span className="text-muted-foreground">Sistema</span>
  if (m.source === 'nfe_entrada') {
    const key = ref.startsWith('nfe:') ? ref.slice(4) : ''
    return (
      <span className="text-muted-foreground">
        NF-e entrada{key ? ` (${key.slice(0, 8)}…)` : ''}
      </span>
    )
  }
  return <span className="text-muted-foreground">Portal</span>
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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [type, setType] = useState<MovementType>('entry')
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
  const selectedType = MOVEMENT_TYPE_OPTIONS.find((o) => o.value === type) ?? MOVEMENT_TYPE_OPTIONS[0]
  const stockTone =
    currentStock < 0
      ? 'text-destructive'
      : currentStock === 0
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-foreground'

  async function handleDeleteMovement (m: Movement) {
    if (!(await appConfirm({
      title: 'Excluir lançamento no estoque?',
      description: 'Esta ação remove o movimento do histórico e recalcula o saldo do produto. Não pode ser desfeita.',
      confirmLabel: 'Excluir',
      destructive: true,
    }))) return

    setDeletingId(m.id)
    try {
      const res = await fetch(
        `/api/portal/produtos/${productId}/estoque?movementId=${encodeURIComponent(m.id)}`,
        { method: 'DELETE' },
      )
      if (res.ok) {
        toast({ title: 'Lançamento excluído' })
        const nextPage = movements.length === 1 && page > 1 ? page - 1 : page
        await fetchStock(nextPage)
        onSuccess?.()
      } else {
        let description = 'Não foi possível excluir o lançamento.'
        try {
          const errJson = await res.json() as { error?: string }
          const code = errJson?.error
          if (code === 'not_found') description = 'Lançamento não encontrado.'
          else if (code === 'not_authenticated') description = 'Sessão expirada. Entre novamente.'
          else if (code === 'forbidden') description = 'Sem permissão para esta ação.'
          else if (typeof code === 'string') description = code
        } catch {
          // mantém mensagem padrão
        }
        toast({
          variant: 'destructive',
          title: 'Erro ao excluir',
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
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-lg border border-border/80 bg-gradient-to-br from-muted/40 via-card to-card px-4 py-5 sm:px-5">
        <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-primary/5" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Estoque atual
            </p>
            <p className={cn('text-4xl font-semibold tabular-nums tracking-tight', stockTone)}>
              {loading && !data ? '—' : currentStock}
            </p>
            <p className="text-sm text-muted-foreground">
              {productName}
              <span className="mx-1.5 text-border">·</span>
              unidade(s) em saldo
            </p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {currentStock < 0 ? (
              <ArrowDownLeft className="h-5 w-5 text-destructive" aria-hidden />
            ) : currentStock === 0 ? (
              <Scale className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
            ) : (
              <Package className="h-5 w-5" aria-hidden />
            )}
          </div>
        </div>
      </div>

      <StockSection
        title="Registrar movimento"
        description={selectedType.hint}
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label id="product-stock-type-label">Tipo</Label>
            <div
              role="radiogroup"
              aria-labelledby="product-stock-type-label"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {MOVEMENT_TYPE_OPTIONS.map((option) => {
                const isSelected = type === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setType(option.value)}
                    className={cn(
                      'rounded-md border px-3 py-2.5 text-left transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      isSelected
                        ? 'border-primary/40 bg-primary/10 text-foreground shadow-sm'
                        : 'border-border/80 bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                    )}
                  >
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug opacity-80">
                      {option.hint}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="product-stock-qty">
                {type === 'balance' ? 'Saldo final' : 'Quantidade'}
              </Label>
              <Input
                id="product-stock-qty"
                type="number"
                inputMode="numeric"
                step={1}
                min={type === 'balance' ? 0 : 1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-stock-unit">Valor unitário (R$)</Label>
              <Input
                id="product-stock-unit"
                type="number"
                step="0.01"
                min={0}
                value={unitValue}
                onChange={(e) => setUnitValue(e.target.value)}
                className="tabular-nums"
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">
              {type === 'balance'
                ? 'O sistema cria entrada ou saída automática até o saldo informado.'
                : 'O valor unitário entra no custo médio das movimentações.'}
            </p>
            <Button type="submit" disabled={submitting} className="min-w-[10rem]">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Salvando...
                </>
              ) : type === 'entry' ? (
                <>
                  <ArrowDownLeft className="mr-2 h-4 w-4" aria-hidden />
                  Registrar entrada
                </>
              ) : type === 'exit' ? (
                <>
                  <ArrowUpRight className="mr-2 h-4 w-4" aria-hidden />
                  Registrar saída
                </>
              ) : type === 'loss' ? (
                <>
                  <CircleAlert className="mr-2 h-4 w-4" aria-hidden />
                  Registrar perda
                </>
              ) : (
                <>
                  <Scale className="mr-2 h-4 w-4" aria-hidden />
                  Aplicar balanço
                </>
              )}
            </Button>
          </div>
        </form>
      </StockSection>

      <StockSection
        title="Histórico"
        description="Movimentações mais recentes deste produto."
        action={
          total > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {total} {total === 1 ? 'lançamento' : 'lançamentos'}
            </Badge>
          ) : null
        }
      >
        {loading && movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <p className="text-sm">Carregando histórico...</p>
          </div>
        ) : movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center">
            <History className="h-5 w-5 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium text-foreground">Nenhum movimento ainda</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Registre uma entrada, saída, perda ou balanço para começar o histórico deste produto.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-md border border-border/70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-3 py-2.5 text-left font-medium">Data</th>
                    <th className="px-3 py-2.5 text-left font-medium">Tipo</th>
                    <th className="px-3 py-2.5 text-right font-medium">Qtd</th>
                    <th className="px-3 py-2.5 text-right font-medium">Total</th>
                    <th className="px-3 py-2.5 text-left font-medium">Origem</th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => {
                    const when = formatMovementDate(m.createdAt)
                    const isDeleting = deletingId === m.id
                    return (
                      <tr
                        key={m.id}
                        className="border-b last:border-0 hover:bg-muted/25"
                      >
                        <td className="px-3 py-2.5 align-middle">
                          <div className="leading-tight">
                            <p className="font-medium tabular-nums text-foreground">{when.date}</p>
                            {when.time ? (
                              <p className="text-xs tabular-nums text-muted-foreground">{when.time}</p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <Badge
                            variant="outline"
                            className={cn('font-medium', movementTypeBadgeClass(m.type))}
                          >
                            {movementTypeLabel(m.type)}
                          </Badge>
                        </td>
                        <td className={cn(
                          'px-3 py-2.5 text-right align-middle font-medium tabular-nums',
                          quantityClass(m.type),
                        )}
                        >
                          {quantityDisplay(m)}
                        </td>
                        <td className="px-3 py-2.5 text-right align-middle tabular-nums text-muted-foreground">
                          {m.totalValueCents ? formatCurrency(m.totalValueCents / 100) : '—'}
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          {originCell(m)}
                        </td>
                        <td className="px-3 py-2.5 text-right align-middle">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label="Excluir lançamento"
                            disabled={isDeleting}
                            onClick={() => void handleDeleteMovement(m)}
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-4 w-4" aria-hidden />
                            )}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages}
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
            ) : null}
          </div>
        )}
      </StockSection>
    </div>
  )
}
