'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CONDITION_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'A+', label: 'A+' },
  { value: 'A', label: 'A' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B', label: 'B' },
  { value: 'B-', label: 'B-' },
]

const STORAGE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: '64', label: '64 GB' },
  { value: '128', label: '128 GB' },
  { value: '256', label: '256 GB' },
  { value: '512', label: '512 GB' },
  { value: '1024', label: '1 TB' },
]

type Props = {
  defaultOpen?: boolean
  initialValues: {
    q: string
    condition: string
    storageGb: string
    color: string
    purchaseDateFrom: string
    purchaseDateTo: string
  }
}

export function SeminovosFilterCollapsible({
  defaultOpen = false,
  initialValues,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const hasFilters = Boolean(
    initialValues.q ||
    initialValues.condition ||
    initialValues.storageGb ||
    initialValues.color ||
    initialValues.purchaseDateFrom ||
    initialValues.purchaseDateTo
  )

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border bg-card px-3 py-3 sm:py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors touch-manipulation min-h-[2.75rem]">
        <span className="flex items-center gap-2">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
          Filtros
          {hasFilters && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              Ativos
            </span>
          )}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 rounded-md border bg-card p-3 sm:p-4">
          <form action="/portal/seminovos" method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="seminovos-q">Busca (modelo, cor, IMEI, informações)</Label>
              <Input
                id="seminovos-q"
                name="q"
                placeholder="Ex: iPhone 13, preto, 123..."
                defaultValue={initialValues.q}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seminovos-condition">Estado</Label>
              <select
                id="seminovos-condition"
                name="condition"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue={initialValues.condition}
              >
                {CONDITION_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seminovos-storageGb">Armazenamento</Label>
              <select
                id="seminovos-storageGb"
                name="storageGb"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue={initialValues.storageGb}
              >
                {STORAGE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seminovos-color">Cor</Label>
              <Input
                id="seminovos-color"
                name="color"
                placeholder="Ex: Preto, Prateado"
                defaultValue={initialValues.color}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seminovos-purchaseDateFrom">Compra (de)</Label>
              <Input
                id="seminovos-purchaseDateFrom"
                name="purchaseDateFrom"
                type="date"
                defaultValue={initialValues.purchaseDateFrom}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seminovos-purchaseDateTo">Compra (até)</Label>
              <Input
                id="seminovos-purchaseDateTo"
                name="purchaseDateTo"
                type="date"
                defaultValue={initialValues.purchaseDateTo}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3 flex-wrap">
              <Button type="submit">Filtrar</Button>
              <Button variant="outline" asChild>
                <Link href="/portal/seminovos">Limpar filtros</Link>
              </Button>
            </div>
          </form>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
