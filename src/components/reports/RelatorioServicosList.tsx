'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { maskedFromCents } from '@/lib/utils/money'
import { formatDateBr } from '@/lib/utils/format-date'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getOrderStatusLabel } from '@/lib/orders/order-status'

const STATUS_DOT_CLASSES: Record<string, string> = {
  orcamento: 'bg-amber-400 shadow-[0_0_0.6rem_rgba(251,191,36,0.9)]',
  aguardando_aprovacao: 'bg-violet-400 shadow-[0_0_0.6rem_rgba(167,139,250,0.9)]',
  aprovado: 'bg-blue-400 shadow-[0_0_0.6rem_rgba(96,165,250,0.9)]',
  aguardando_pecas: 'bg-orange-400 shadow-[0_0_0.6rem_rgba(251,146,60,0.9)]',
  em_manutencao: 'bg-indigo-400 shadow-[0_0_0.6rem_rgba(129,140,248,0.9)]',
  aguardando_retirada: 'bg-emerald-400 shadow-[0_0_0.6rem_rgba(52,211,153,0.9)]',
  finalizada: 'bg-green-400 shadow-[0_0_0.6rem_rgba(74,222,128,0.9)]',
  finalizada_sem_conserto: 'bg-slate-400 shadow-[0_0_0.6rem_rgba(148,163,184,0.9)]',
  finalizada_sem_aprovacao: 'bg-slate-400 shadow-[0_0_0.6rem_rgba(148,163,184,0.9)]',
  cancelada: 'bg-red-400 shadow-[0_0_0.6rem_rgba(248,113,113,0.9)]',
}

type ServiceItem = {
  kind?: 'service' | 'product' | null
  description?: string
  valueCents?: number
  costCents?: number
  unitValueCents?: number
  unitCostCents?: number
  quantity?: number
}

type FeeBreakdownItem = {
  type: string
  feePercent: number
  valueCents: number
  feeCents: number
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  credito: 'Crédito',
  debito: 'Débito',
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  boleto: 'Boleto',
  outro: 'Outro',
}

type OrderRow = {
  id: string
  display_number: number | null
  status: string
  title: string | null
  created_at: string | null
  closed_at: string | null
  is_warranty?: boolean
  services: unknown
  services_total_cents: number | null
  services_cost_total_cents: number | null
  payment_fees_cents?: number
  net_received_cents?: number
  payment_fees_breakdown?: FeeBreakdownItem[]
}

function parseServicesItems(raw: unknown): ServiceItem[] {
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const items = Array.isArray(parsed?.items)
      ? parsed.items
      : Array.isArray(parsed)
        ? parsed
        : []
    return items.slice(0, 50).map((i: any) => {
      const qty = Math.max(1, Number(i?.quantity) || 1)
      const unitVal = Number(i?.unitValueCents ?? i?.valueCents ?? 0) || 0
      const unitCost = Number(i?.unitCostCents ?? i?.costCents ?? 0) || 0
      const kind = i?.kind === 'product' ? 'product' as const : 'service' as const
      return {
        kind,
        description: String(i?.description ?? '').trim(),
        valueCents: i.valueCents ?? unitVal * qty,
        costCents: i.costCents ?? unitCost * qty,
      }
    })
  } catch {
    return []
  }
}

type SortKey = 'display_number' | 'created_at' | 'closed_at' | 'sla' | 'gross' | 'cost' | 'fees' | 'net'

function getSortValue (order: OrderRow, key: SortKey): number | string {
  switch (key) {
    case 'display_number':
      return order.display_number ?? -1
    case 'created_at':
      return order.created_at ? new Date(order.created_at).getTime() : 0
    case 'closed_at':
      return order.closed_at ? new Date(order.closed_at).getTime() : 0
    case 'sla': {
      if (!order.created_at || !order.closed_at) return 0
      const diff = new Date(order.closed_at).getTime() - new Date(order.created_at).getTime()
      return diff <= 0 ? 0 : diff
    }
    case 'gross':
      return order.services_total_cents ?? 0
    case 'cost':
      return order.services_cost_total_cents ?? 0
    case 'fees':
      return order.payment_fees_cents ?? 0
    case 'net': {
      const g = order.services_total_cents ?? 0
      const c = order.services_cost_total_cents ?? 0
      const f = order.payment_fees_cents ?? 0
      return g - c - f
    }
    default:
      return 0
  }
}

function formatSla(createdAt: string | null, closedAt: string | null): string {
  if (!createdAt || !closedAt) return '-'
  const created = new Date(createdAt)
  const closed = new Date(closedAt)
  const diffMs = closed.getTime() - created.getTime()
  if (diffMs <= 0) return '-'
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  return `${hours}h`
}

function FaturamentoRow ({ order }: { order: OrderRow }) {
  const [modalOpen, setModalOpen] = useState(false)
  const gross = order.services_total_cents ?? 0
  const cost = order.services_cost_total_cents ?? 0
  const fees = order.payment_fees_cents ?? 0
  const netReceived = gross - cost - fees
  const feeBreakdown = order.payment_fees_breakdown ?? []

  const taxasTooltip = feeBreakdown.length > 0 ? (
    <div className="space-y-1 max-w-xs">
      {feeBreakdown.map((f, i) => (
        <div key={i} className="text-xs">
          {PAYMENT_TYPE_LABELS[f.type] ?? f.type} ({f.feePercent}%) — R$ {maskedFromCents(f.feeCents)}
        </div>
      ))}
    </div>
  ) : (
    <span className="text-xs">Sem taxas de pagamento</span>
  )

  const dotClass = STATUS_DOT_CLASSES[order.status] ?? 'bg-muted shadow-[0_0_0.6rem_rgba(148,163,184,0.7)]'

  return (
    <TableRow>
      <TableCell className="w-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-block h-2.5 w-2.5 rounded-full cursor-default ${dotClass}`} aria-hidden />
          </TooltipTrigger>
          <TooltipContent>{getOrderStatusLabel(order.status)}</TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell>
        <Link
          href={`/portal/ordens/${order.id}`}
          className="font-medium hover:underline text-primary block"
        >
          <span className="inline-flex items-center gap-2 font-mono text-sm">
            #{order.display_number ?? '-'}
            {order.is_warranty && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-px text-[10px] font-medium text-amber-700 dark:text-amber-300">
                Garantia
              </span>
            )}
          </span>
          {order.title ? (
            <span className="block text-xs text-muted-foreground font-normal mt-0.5 truncate max-w-[200px]">
              {order.title}
            </span>
          ) : null}
        </Link>
      </TableCell>
      <TableCell className="text-sm tabular-nums whitespace-nowrap">
        {order.created_at ? formatDateBr(order.created_at) : '-'}
      </TableCell>
      <TableCell className="text-sm tabular-nums whitespace-nowrap">
        {order.closed_at ? formatDateBr(order.closed_at) : '-'}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">
        {formatSla(order.created_at, order.closed_at)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm tabular-nums whitespace-nowrap">
        R$ {maskedFromCents(gross)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground whitespace-nowrap">
        R$ {maskedFromCents(cost)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm tabular-nums whitespace-nowrap">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help text-muted-foreground">R$ {maskedFromCents(fees)}</span>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-sm">
            {taxasTooltip}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="text-right font-mono text-sm tabular-nums whitespace-nowrap">
        <FaturamentoDetailModal
          order={order}
          open={modalOpen}
          onOpenChange={setModalOpen}
          trigger={
            <button
              type="button"
              className={`cursor-pointer hover:opacity-80 focus:outline-none focus:ring-0 font-medium ${netReceived >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
            >
              R$ {maskedFromCents(netReceived)}
            </button>
          }
        />
      </TableCell>
    </TableRow>
  )
}

function FaturamentoDetailModal ({
  order,
  open,
  onOpenChange,
  trigger,
}: {
  order: OrderRow
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: React.ReactNode
}) {
  const items = parseServicesItems(order.services)
  const feeBreakdown = order.payment_fees_breakdown ?? []
  const gross = order.services_total_cents ?? 0
  const cost = order.services_cost_total_cents ?? 0
  const fees = order.payment_fees_cents ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Faturamento #{order.display_number ?? order.id}</DialogTitle>
        </DialogHeader>
        <div className="font-mono text-sm tabular-nums space-y-0.5">
          <div className="flex justify-between gap-4 pb-2 mb-2 border-b">
            <span className="font-medium">Total cobrado</span>
            <span className="whitespace-nowrap">R$ {maskedFromCents(gross)}</span>
          </div>
          {items.length > 0 ? (
            <>
              {items.map((s, i) => (
                <div key={i}>
                  <div className="flex justify-between gap-4">
                    <span className="min-w-0 break-words">+ {s.description || (s.kind === 'product' ? 'Peça' : 'Serviço')}</span>
                    <span className="shrink-0 whitespace-nowrap">R$ {maskedFromCents(s.valueCents ?? 0)}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <span>− Custo</span>
                    <span className="shrink-0 whitespace-nowrap">R$ {maskedFromCents(s.costCents ?? 0)}</span>
                  </div>
                </div>
              ))}
              {(() => {
                const itemsCostSum = items.reduce((acc, s) => acc + (s.costCents ?? 0), 0)
                const costResto = cost - itemsCostSum
                if (costResto > 0) {
                  return (
                    <div className="flex justify-between gap-4 text-muted-foreground">
                      <span>− Custo</span>
                      <span className="shrink-0 whitespace-nowrap">R$ {maskedFromCents(costResto)}</span>
                    </div>
                  )
                }
                return null
              })()}
            </>
          ) : (
            <>
              <div className="flex justify-between gap-4">
                <span>+ Total</span>
                <span className="shrink-0 whitespace-nowrap">R$ {maskedFromCents(gross)}</span>
              </div>
              {cost > 0 && (
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <span>− Custo</span>
                  <span className="shrink-0 whitespace-nowrap">R$ {maskedFromCents(cost)}</span>
                </div>
              )}
            </>
          )}
          {feeBreakdown.length > 0 ? (
            feeBreakdown.map((f, i) => (
              <div key={i} className="flex justify-between gap-4 text-muted-foreground">
                <span>− Taxas {PAYMENT_TYPE_LABELS[f.type] ?? f.type} ({f.feePercent}%)</span>
                <span className="shrink-0 whitespace-nowrap">R$ {maskedFromCents(f.feeCents)}</span>
              </div>
            ))
          ) : fees > 0 ? (
            <div key="taxas" className="flex justify-between gap-4 text-muted-foreground">
              <span>− Taxas</span>
              <span className="shrink-0 whitespace-nowrap">R$ {maskedFromCents(fees)}</span>
            </div>
          ) : null}
          <div className={`flex justify-between gap-4 pt-2 mt-2 border-t font-medium ${(gross - cost - fees) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            <span>=</span>
            <span className="shrink-0 whitespace-nowrap">R$ {maskedFromCents(gross - cost - fees)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SortableTh ({
  label,
  sortKey,
  currentSort,
  sortDir,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  currentSort: SortKey | null
  sortDir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
  align?: 'left' | 'right'
}) {
  const isActive = currentSort === sortKey
  return (
    <TableHead className={align === 'right' ? 'text-right' : ''}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring rounded ${align === 'right' ? 'ml-auto' : ''}`}
      >
        {label}
        {isActive ? (
          sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5 shrink-0" /> : <ArrowDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        )}
      </button>
    </TableHead>
  )
}

const PAGE_SIZE = 20

export function RelatorioServicosList({ orders }: { orders: OrderRow[] }) {
  const [sortBy, setSortBy] = useState<SortKey | null>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
    setPage(1)
  }

  const sortedOrders = useMemo(() => {
    if (!sortBy) return orders
    return [...orders].sort((a, b) => {
      const va = getSortValue(a, sortBy)
      const vb = getSortValue(b, sortBy)
      if (typeof va === 'number' && typeof vb === 'number') {
        const diff = va - vb
        return sortDir === 'asc' ? diff : -diff
      }
      const sa = String(va)
      const sb = String(vb)
      const cmp = sa.localeCompare(sb)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [orders, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / PAGE_SIZE))
  const safePage = Math.max(1, Math.min(page, totalPages))
  const paginatedOrders = useMemo(
    () => sortedOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sortedOrders, safePage]
  )
  const fromItem = (safePage - 1) * PAGE_SIZE + 1
  const toItem = Math.min(safePage * PAGE_SIZE, sortedOrders.length)

  if (orders.length === 0) return null

  return (
    <TooltipProvider>
      <div className="w-full space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <SortableTh label="ID" sortKey="display_number" currentSort={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Criação" sortKey="created_at" currentSort={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Fechamento" sortKey="closed_at" currentSort={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="SLA" sortKey="sla" currentSort={sortBy} sortDir={sortDir} onSort={handleSort} align="right" />
              <SortableTh label="Cobrado" sortKey="gross" currentSort={sortBy} sortDir={sortDir} onSort={handleSort} align="right" />
              <SortableTh label="Custo" sortKey="cost" currentSort={sortBy} sortDir={sortDir} onSort={handleSort} align="right" />
              <SortableTh label="Taxas" sortKey="fees" currentSort={sortBy} sortDir={sortDir} onSort={handleSort} align="right" />
              <SortableTh label="Líquido" sortKey="net" currentSort={sortBy} sortDir={sortDir} onSort={handleSort} align="right" />
            </TableRow>
          </TableHeader>
        <TableBody>
          {paginatedOrders.map((o) => (
            <FaturamentoRow key={o.id} order={o} />
          ))}
        </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {fromItem}-{toItem} de {sortedOrders.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                Anterior
              </Button>
              <span className="text-sm tabular-nums">
                Página {safePage} de {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
