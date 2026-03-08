'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ChevronDown } from 'lucide-react'

const OPEN_STATUSES = [
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'aguardando_aprovacao', label: 'Aguardando aprovação' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'aguardando_pecas', label: 'Aguardando peças' },
  { value: 'em_manutencao', label: 'Em manutenção' },
  { value: 'aguardando_retirada', label: 'Aguardando retirada' },
] as const

const CLOSED_STATUSES = [
  { value: 'finalizada', label: 'Finalizada' },
  { value: 'finalizada_sem_conserto', label: 'Finalizada sem conserto' },
  { value: 'finalizada_sem_aprovacao', label: 'Finalizada sem aprovação' },
  { value: 'cancelada', label: 'Cancelada' },
] as const

export type StatusGroup = 'open' | 'closed' | ''

export function useRelatorioServicosFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const statusGroup = (searchParams?.get('statusGroup') || '') as StatusGroup
  const statusParam = searchParams?.getAll('status') ?? []
  const selectedStatuses = Array.isArray(statusParam) ? statusParam : [statusParam].filter(Boolean)

  const statusOptions = statusGroup === 'open'
    ? OPEN_STATUSES
    : statusGroup === 'closed'
      ? CLOSED_STATUSES
      : [...OPEN_STATUSES, ...CLOSED_STATUSES]

  function updateParams(updates: { statusGroup?: StatusGroup; status?: string[] }) {
    const params = new URLSearchParams(searchParams?.toString() || '')
    if (updates.statusGroup !== undefined) {
      if (updates.statusGroup) params.set('statusGroup', updates.statusGroup)
      else params.delete('statusGroup')
    }
    if (updates.status !== undefined) {
      params.delete('status')
      for (const s of updates.status) {
        if (s) params.append('status', s)
      }
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return {
    statusGroup,
    selectedStatuses,
    statusOptions,
    updateParams,
  }
}

export function RelatorioServicosStatusSelect() {
  const { selectedStatuses, statusOptions, updateParams } = useRelatorioServicosFilters()

  function handleStatusToggle(value: string, checked: boolean) {
    const next = checked
      ? [...selectedStatuses, value]
      : selectedStatuses.filter((s) => s !== value)
    updateParams({ status: next })
  }

  const statusTriggerLabel =
    selectedStatuses.length === 0
      ? 'Todos os status'
      : selectedStatuses.length === statusOptions.length
        ? 'Todos os status'
        : `${selectedStatuses.length} selecionado(s)`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="h-9 w-full justify-between rounded-md border border-input bg-background px-3 text-sm font-normal shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {statusTriggerLabel}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="max-h-[280px] overflow-y-auto space-y-2">
          {statusOptions.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 cursor-pointer text-sm rounded-sm py-1.5 px-2 hover:bg-accent hover:text-accent-foreground"
            >
              <Checkbox
                checked={selectedStatuses.includes(opt.value)}
                onCheckedChange={(checked) =>
                  handleStatusToggle(opt.value, Boolean(checked))
                }
              />
              {opt.label}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function RelatorioServicosQuickFilter() {
  const { statusGroup, updateParams } = useRelatorioServicosFilters()

  function handleQuickFilter(group: StatusGroup) {
    updateParams({ statusGroup: group, status: [] })
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="text-xs text-muted-foreground">Filtro rápido:</span>
      <Button
        type="button"
        size="sm"
        variant={statusGroup === '' ? 'default' : 'outline'}
        onClick={() => handleQuickFilter('')}
        className="h-7 px-2 text-xs"
      >
        Todas
      </Button>
      <Button
        type="button"
        size="sm"
        variant={statusGroup === 'open' ? 'default' : 'outline'}
        onClick={() => handleQuickFilter('open')}
        className="h-7 px-2 text-xs"
      >
        Abertas
      </Button>
      <Button
        type="button"
        size="sm"
        variant={statusGroup === 'closed' ? 'default' : 'outline'}
        onClick={() => handleQuickFilter('closed')}
        className="h-7 px-2 text-xs"
      >
        Fechadas
      </Button>
    </div>
  )
}
