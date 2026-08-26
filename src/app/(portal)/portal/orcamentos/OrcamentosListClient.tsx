'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateBr } from '@/lib/utils/format-date'
import { formatCentsBr } from '@/lib/utils/format-money'
import { getOrcamentoPortalPath } from '@/lib/quotes/quote-portal-path'
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_VALUES,
} from '@/lib/quotes/quote-status'
import { OrcamentoActionsMenu } from './OrcamentoActionsMenu'

export type QuoteListRow = {
  id: string
  display_number: number | null
  title: string | null
  status: string
  valid_until: string | null
  items_total_cents: number | null
  share_token: string | null
  created_at: string
  service_order_id: string | null
  service_order_display_number?: number | null
  customers: {
    is_company?: boolean | null
    full_name?: string | null
    company_name?: string | null
    email?: string | null
    mobile_phone?: string | null
  } | null
}

type Props = {
  rows: QuoteListRow[]
  q: string
  status: string
}

function customerLabel (c: QuoteListRow['customers']): string {
  if (!c) return '—'
  if (c.is_company) return c.company_name || c.full_name || '—'
  return c.full_name || '—'
}

export function OrcamentosListClient ({ rows, q, status }: Props) {
  const router = useRouter()

  function applyFilters (form: HTMLFormElement) {
    const fd = new FormData(form)
    const params = new URLSearchParams()
    const nextQ = String(fd.get('q') || '').trim()
    const nextStatus = String(fd.get('status') || '').trim()
    if (nextQ) params.set('q', nextQ)
    if (nextStatus && nextStatus !== 'all') params.set('status', nextStatus)
    const qs = params.toString()
    router.push(qs ? `/portal/orcamentos?${qs}` : '/portal/orcamentos')
  }

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          applyFilters(e.currentTarget)
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="q">Busca</Label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Número, título ou cliente"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={status || 'all'}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="all">Todos</option>
            {QUOTE_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {QUOTE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum orçamento encontrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={getOrcamentoPortalPath(row)}
                      className="font-medium tabular-nums hover:underline"
                    >
                      #{row.display_number ?? '—'}
                    </Link>
                  </TableCell>
                  <TableCell>{customerLabel(row.customers)}</TableCell>
                  <TableCell className="max-w-[16rem] truncate">
                    {row.title || 'Orçamento'}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.valid_until
                      ? formatDateBr(`${row.valid_until}T12:00:00-03:00`)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <QuoteStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCentsBr(row.items_total_cents ?? 0)}
                  </TableCell>
                  <TableCell>
                    <OrcamentoActionsMenu
                      quoteId={row.id}
                      displayNumber={row.display_number ?? row.id}
                      title={row.title || 'Orçamento'}
                      status={row.status}
                      validUntil={row.valid_until}
                      totalCents={row.items_total_cents ?? 0}
                      shareToken={row.share_token}
                      customer={row.customers}
                      serviceOrderHref={
                        row.service_order_id
                          ? `/portal/ordens/${row.service_order_display_number ?? row.service_order_id}`
                          : null
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
