'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TableCell, TableRow } from '@/components/ui/table'
import { OrderStatusBadge } from '@/components/orders'
import { OrdensRowActions } from './OrdensRowActions'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatDateTimeBr } from '@/lib/utils/format-date'

type OrderRow = {
  id: string
  display_number: number | null
  status: string
  title: string
  created_at: string
  updated_at: string
  closed_at: string | null
  estimated_ready_at: string | null
  share_token?: string | null
  customers: {
    cpf?: string | null
    cnpj?: string | null
    is_company?: boolean
    full_name?: string | null
    company_name?: string | null
    email?: string | null
    mobile_phone?: string | null
  } | null
  device_models: { brand?: string; device_type?: string; model?: string } | null
}

type Props = {
  order: OrderRow
}

export function OrdensTableRow({ order }: Props) {
  const router = useRouter()

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => router.push(`/portal/ordens/${order.id}`)}
    >
      <TableCell className="font-medium">#{order.display_number ?? order.id}</TableCell>
      <TableCell>
        <OrderStatusBadge status={order.status} />
      </TableCell>
      <TableCell className="font-medium">
        <Link
          href={`/portal/ordens/${order.id}`}
          className="hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {order.title}
        </Link>
      </TableCell>
      <TableCell>
        {order.customers?.is_company
          ? (order.customers?.company_name || '-')
          : (order.customers?.full_name || '-')}
      </TableCell>
      <TableCell>
        {order.device_models
          ? [order.device_models.brand, order.device_models.device_type, order.device_models.model].filter(Boolean).join(' • ') || '-'
          : '-'}
      </TableCell>
      <TableCell>
        {formatCpfCnpj(String(order.customers?.cnpj || order.customers?.cpf))}
      </TableCell>
      <TableCell>{formatDateTimeBr(order.created_at)}</TableCell>
      <TableCell>{formatDateTimeBr(order.estimated_ready_at)}</TableCell>
      <TableCell>{order.closed_at ? formatDateTimeBr(order.closed_at) : '-'}</TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <OrdensRowActions order={order} />
      </TableCell>
    </TableRow>
  )
}
