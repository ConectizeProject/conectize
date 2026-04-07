'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getOrderStatusLabel } from '@/lib/orders/order-status'
import { DragScrollRow } from './DragScrollRow'
import { OrdemCard } from './OrdemCard'
import { OrdensFinalSection } from './OrdensFinalSection'
import type { PortalOrdensListRow } from '@/lib/orders/portal-ordens-list-types'

const OPEN_STATUS_ORDER = [
  'em_manutencao',
  'aprovado',
  'orcamento',
  'aguardando_aprovacao',
  'aguardando_pecas',
  'aguardando_retirada',
] as const

const STATUS_DOT_CLASSES: Record<string, string> = {
  orcamento: 'bg-amber-400 shadow-[0_0_0.6rem_rgba(251,191,36,0.9)]',
  aguardando_aprovacao: 'bg-violet-400 shadow-[0_0_0.6rem_rgba(167,139,250,0.9)]',
  aprovado: 'bg-blue-400 shadow-[0_0_0.6rem_rgba(96,165,250,0.9)]',
  aguardando_pecas: 'bg-orange-400 shadow-[0_0_0.6rem_rgba(251,146,60,0.9)]',
  em_manutencao: 'bg-indigo-400 shadow-[0_0_0.6rem_rgba(129,140,248,0.9)]',
  aguardando_retirada: 'bg-emerald-400 shadow-[0_0_0.6rem_rgba(52,211,153,0.9)]',
}

type Props = {
  openOrdersByStatus: Record<string, PortalOrdensListRow[]>
  filterQ: string
  filterCpf: string
  filterOsNumber: string
  filterStatus: string
  filterCustomerId?: string
  filterCustomerName?: string
  filterDeviceModelId?: string
  filterCreatedFrom?: string
  filterCreatedTo?: string
  filterReadyFrom?: string
  filterReadyTo?: string
  canDelete: boolean
}

export function OrdensListClient({
  openOrdersByStatus,
  filterQ,
  filterCpf,
  filterOsNumber,
  filterStatus,
  filterCustomerId = '',
  filterCustomerName = '',
  filterDeviceModelId = '',
  filterCreatedFrom = '',
  filterCreatedTo = '',
  filterReadyFrom = '',
  filterReadyTo = '',
  canDelete,
}: Props) {
  const totalOpen = OPEN_STATUS_ORDER.reduce((acc, s) => acc + (openOrdersByStatus[s]?.length ?? 0), 0)

  return (
    <div className="space-y-4">
      {totalOpen === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 px-4">
            <img src="/empty-ordens.svg" alt="" className="w-36 h-36 mx-auto mb-5 object-contain" aria-hidden />
            <p className="text-base font-medium text-muted-foreground">Nenhuma ordem em aberto</p>
            <p className="text-sm text-muted-foreground/80 mt-1.5 max-w-xs text-center">Abra a seção abaixo ou cadastre uma nova ordem.</p>
            <Button asChild className="mt-4">
              <Link href="/portal/ordens/nova">Nova ordem</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {OPEN_STATUS_ORDER.map((status) => {
        const list = openOrdersByStatus[status] ?? []
        if (list.length === 0) return null
        const label = getOrderStatusLabel(status)
        const dotClass = STATUS_DOT_CLASSES[status] ?? 'bg-muted shadow-[0_0_0.6rem_rgba(148,163,184,0.7)]'
        return (
          <section key={status} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} aria-hidden />
              <span>{label}</span>
              <span className="text-xs font-normal text-muted-foreground">
                ({list.length})
              </span>
            </div>
            <DragScrollRow>
              {list.map((order) => (
                <OrdemCard key={order.id} order={order} canDelete={canDelete} />
              ))}
            </DragScrollRow>
          </section>
        )
      })}

      <OrdensFinalSection
        key={`final-${filterQ}-${filterCpf}-${filterOsNumber}-${filterStatus}-${filterCustomerId}-${filterDeviceModelId}-${filterCreatedFrom}-${filterCreatedTo}-${filterReadyFrom}-${filterReadyTo}`}
        q={filterQ}
        cpf={filterCpf}
        osNumber={filterOsNumber}
        status={filterStatus}
        customerId={filterCustomerId}
        customerName={filterCustomerName}
        deviceModelId={filterDeviceModelId}
        createdFrom={filterCreatedFrom}
        createdTo={filterCreatedTo}
        readyFrom={filterReadyFrom}
        readyTo={filterReadyTo}
        defaultOpen={false}
      />
    </div>
  )
}
