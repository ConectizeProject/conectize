'use client'

import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { OrdemCard } from './OrdemCard'
import { OrdensFinalSection } from './OrdensFinalSection'

const OPEN_STATUS_ORDER = [
  'em_manutencao',
  'aprovado',
  'orcamento',
  'aguardando_pecas',
  'aguardando_retirada',
] as const

const STATUS_LABELS: Record<string, string> = {
  orcamento: 'Orçamento',
  aprovado: 'Aprovado',
  aguardando_pecas: 'Aguardando peças',
  em_manutencao: 'Em manutenção',
  aguardando_retirada: 'Aguardando retirada',
}

const STATUS_DOT_CLASSES: Record<string, string> = {
  orcamento: 'bg-amber-400 shadow-[0_0_0.6rem_rgba(251,191,36,0.9)]',
  aprovado: 'bg-blue-400 shadow-[0_0_0.6rem_rgba(96,165,250,0.9)]',
  aguardando_pecas: 'bg-orange-400 shadow-[0_0_0.6rem_rgba(251,146,60,0.9)]',
  em_manutencao: 'bg-indigo-400 shadow-[0_0_0.6rem_rgba(129,140,248,0.9)]',
  aguardando_retirada: 'bg-emerald-400 shadow-[0_0_0.6rem_rgba(52,211,153,0.9)]',
}

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
  customers: Record<string, unknown> | null
  device_models: Record<string, unknown> | null
}

type Props = {
  openOrdersByStatus: Record<string, OrderRow[]>
  filterQ: string
  filterCpf: string
  filterOsNumber: string
  filterStatus: string
  canDelete: boolean
}

export function OrdensListClient({ openOrdersByStatus, filterQ, filterCpf, filterOsNumber, filterStatus, canDelete }: Props) {
  const totalOpen = OPEN_STATUS_ORDER.reduce((acc, s) => acc + (openOrdersByStatus[s]?.length ?? 0), 0)
  const hasFilters = Boolean(filterQ || filterCpf || filterOsNumber || filterStatus)

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
        const label = STATUS_LABELS[status] ?? status
        const dotClass = STATUS_DOT_CLASSES[status] ?? 'bg-muted shadow-[0_0_0.6rem_rgba(148,163,184,0.7)]'
        return (
          <Collapsible key={status} defaultOpen>
            <CollapsibleTrigger className="flex w-full bg-card items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
              <span className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} aria-hidden />
                <span>{label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  ({list.length})
                </span>
              </span>
              <ChevronDown className="ml-auto h-4 w-4 transition-transform data-[state=open]:rotate-0 data-[state=closed]:-rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {list.map((order) => (
                  <OrdemCard key={order.id} order={order as any} canDelete={canDelete} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}

      <OrdensFinalSection
        key={`final-${filterQ}-${filterCpf}-${filterOsNumber}-${filterStatus}`}
        q={filterQ}
        cpf={filterCpf}
        osNumber={filterOsNumber}
        status={filterStatus}
        defaultOpen={hasFilters}
      />
    </div>
  )
}
