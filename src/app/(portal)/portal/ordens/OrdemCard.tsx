'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
    id?: string
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
  canDelete?: boolean
}

export function OrdemCard({ order, canDelete }: Props) {
  const router = useRouter()

  const customerName = order.customers?.full_name || order.customers?.company_name || '-'
  const deviceText = order.device_models
    ? [order.device_models.brand, order.device_models.device_type, order.device_models.model].filter(Boolean).join(' • ') || '-'
    : '-'
  const cpfCnpj = formatCpfCnpj(String(order.customers?.cnpj || order.customers?.cpf))

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => router.push(`/portal/ordens/${order.id}`)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <span className="font-semibold">#{order.display_number ?? order.id}</span>
        <div className="flex flex-row items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <OrderStatusBadge status={order.status} />
          <OrdensRowActions order={order} canDelete={canDelete} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-medium leading-tight">{order.title}</p>
        <dl className="grid gap-1 text-sm text-muted-foreground">
          <div className="flex justify-between gap-2">
            <dt>Cliente</dt>
            <dd className="text-right truncate max-w-[180px]" title={customerName}>{customerName}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Dispositivo</dt>
            <dd className="text-right truncate max-w-[180px]" title={deviceText}>{deviceText}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>CPF/CNPJ</dt>
            <dd>{cpfCnpj}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Criada</dt>
            <dd>{formatDateTimeBr(order.created_at)}</dd>
          </div>
          {order.estimated_ready_at ? (
            <div className="flex justify-between gap-2">
              <dt>Estimativa</dt>
              <dd>{formatDateTimeBr(order.estimated_ready_at)}</dd>
            </div>
          ) : null}
          {order.closed_at ? (
            <div className="flex justify-between gap-2">
              <dt>Finalizada</dt>
              <dd>{formatDateTimeBr(order.closed_at)}</dd>
            </div>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  )
}
