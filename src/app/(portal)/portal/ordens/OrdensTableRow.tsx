'use client'

import { useState } from 'react'
import Link from 'next/link'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { OrderStatusBadge, CustomerOrderHistoryModal } from '@/components/orders'
import { OrdensRowActions } from './OrdensRowActions'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { getOrdemPortalPath } from '@/lib/orders/ordem-portal-path'
import type { PortalOrdensListRow } from '@/lib/orders/portal-ordens-list-types'

type Props = {
  order: PortalOrdensListRow
}

export function OrdensTableRow({ order }: Props) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const customerId = order.customers?.id ?? ''

  return (
    <>
      <TableRow className="hover:bg-muted/50">
        <TableCell colSpan={9} className="relative p-0 align-middle">
          <Link
            href={getOrdemPortalPath(order)}
            className="absolute inset-0 z-0"
            aria-label={`Abrir ordem ${order.display_number ?? order.id}`}
            transitionTypes={['nav-forward']}
          />
          <div className="relative z-10 grid grid-cols-9 gap-2 items-center py-2 px-4 cursor-pointer">
            <span className="font-medium">#{order.display_number ?? order.id}</span>
            <span>
              <OrderStatusBadge status={order.status} />
            </span>
            <span className="font-medium">{order.title}</span>
            <span>{order.customers?.full_name || order.customers?.company_name || '-'}</span>
            <span>
              {order.device_models
                ? [order.device_models.brand, order.device_models.device_type, order.device_models.model].filter(Boolean).join(' • ') || '-'
                : '-'}
            </span>
            <span>{formatCpfCnpj(String(order.customers?.cnpj || order.customers?.cpf))}</span>
            <span>{formatDateTimeBr(order.created_at)}</span>
            <span>{formatDateTimeBr(order.estimated_ready_at)}</span>
            <span>{order.closed_at ? formatDateTimeBr(order.closed_at) : '-'}</span>
          </div>
        </TableCell>
        <TableCell className="text-right relative z-10" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {customerId ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsHistoryOpen(true)}
                aria-label="Ver histórico de ordens do cliente"
              >
                <History className="h-4 w-4" />
              </Button>
            ) : null}
            <OrdensRowActions order={order} />
          </div>
        </TableCell>
      </TableRow>

      {customerId ? (
        <CustomerOrderHistoryModal
          open={isHistoryOpen}
          onOpenChange={setIsHistoryOpen}
          customerId={customerId}
          isCreationPage={false}
        />
      ) : null}
    </>
  )
}
