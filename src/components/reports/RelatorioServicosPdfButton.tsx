'use client'

import { useCallback } from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { maskedFromCents } from '@/lib/utils/money'
import { formatDateBr } from '@/lib/utils/format-date'
import { getOrderStatusLabel } from '@/lib/orders/order-status'

export type RelatorioServicosPdfOrder = {
  id: string
  display_number: number | string | null
  status: string
  title: string | null
  created_at: string | null
  closed_at: string | null
  services_total_cents: number | null
  services_cost_total_cents: number | null
  payment_fees_cents?: number
}

function escapeHtml (s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatSla (createdAt: string | null, closedAt: string | null): string {
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

type Props = {
  orders: RelatorioServicosPdfOrder[]
  periodLabel: string
  filterNote?: string | null
}

export function RelatorioServicosPdfButton ({ orders, periodLabel, filterNote }: Props) {
  const handlePdf = useCallback(() => {
    if (typeof window === 'undefined' || orders.length === 0) return

    const rows = orders.map((o) => {
      const gross = o.services_total_cents ?? 0
      const cost = o.services_cost_total_cents ?? 0
      const fees = o.payment_fees_cents ?? 0
      const net = gross - cost - fees
      return `
        <tr>
          <td>${o.display_number != null ? `#${escapeHtml(String(o.display_number))}` : '-'}</td>
          <td>${escapeHtml(getOrderStatusLabel(o.status))}</td>
          <td class="title">${escapeHtml((o.title || '').trim() || '-')}</td>
          <td>${o.created_at ? escapeHtml(formatDateBr(o.created_at)) : '-'}</td>
          <td>${o.closed_at ? escapeHtml(formatDateBr(o.closed_at)) : '-'}</td>
          <td>${escapeHtml(formatSla(o.created_at, o.closed_at))}</td>
          <td class="num">R$ ${maskedFromCents(gross)}</td>
          <td class="num">R$ ${maskedFromCents(cost)}</td>
          <td class="num">R$ ${maskedFromCents(fees)}</td>
          <td class="num">R$ ${maskedFromCents(net)}</td>
        </tr>`
    }).join('')

    const filterBlock = filterNote
      ? `<p class="filter-note">${escapeHtml(filterNote)}</p>`
      : ''

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório de serviços — Conectize</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; font-size: 11px; color: #111; padding: 16px 20px; }
    h1 { font-size: 18px; margin: 0 0 4px 0; }
    .meta { color: #555; margin-bottom: 8px; font-size: 12px; }
    .filter-note { background: #f4f4f5; padding: 8px 10px; border-radius: 6px; margin-bottom: 12px; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f4f4f5; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.02em; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    td.title { max-width: 180px; word-break: break-word; }
    .footer { margin-top: 16px; font-size: 10px; color: #666; }
    @media print {
      body { padding: 12px; }
      @page { size: A4 landscape; margin: 12mm; }
    }
  </style>
</head>
<body>
  <h1>Relatório de ordens de serviço</h1>
  <p class="meta">${escapeHtml(periodLabel)} · ${orders.length} ordem(ns)</p>
  ${filterBlock}
  <table>
    <thead>
      <tr>
        <th>OS</th>
        <th>Status</th>
        <th>Título</th>
        <th>Criação</th>
        <th>Fechamento</th>
        <th>SLA</th>
        <th>Cobrado</th>
        <th>Custo</th>
        <th>Taxas</th>
        <th>Líquido</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="footer">Gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))}</p>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.open()
    win.document.write(html)
    win.document.close()
  }, [orders, periodLabel, filterNote])

  if (orders.length === 0) return null

  return (
    <Button type="button" variant="outline" size="sm" onClick={handlePdf} className="gap-2">
      <FileDown className="h-4 w-4" />
      Gerar PDF da lista
    </Button>
  )
}
