'use client'

import Link from 'next/link'
import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
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
  initialValues: {
    q: string
    condition: string
    storageGb: string
    color: string
    purchaseDateFrom: string
    purchaseDateTo: string
    stockType: 'seminovo' | 'lacrado'
  }
  quickFilters: {
    notTested: boolean
    notAdvertised: boolean
    noLabel: boolean
    withInfo: boolean
    onToggleNotTested: () => void
    onToggleNotAdvertised: () => void
    onToggleNoLabel: () => void
    onToggleWithInfo: () => void
  }
}

function hasUrlExtraFilters (initialValues: Props['initialValues']) {
  return Boolean(
    initialValues.condition ||
    initialValues.storageGb ||
    initialValues.color ||
    initialValues.purchaseDateFrom ||
    initialValues.purchaseDateTo,
  )
}

export function SeminovosFilterCollapsible ({
  initialValues,
  quickFilters,
}: Props) {
  const urlExtra = hasUrlExtraFilters(initialValues)
  const [extraOpen, setExtraOpen] = useState(urlExtra)

  const hasQuickActive =
    quickFilters.notTested ||
    quickFilters.notAdvertised ||
    quickFilters.noLabel ||
    quickFilters.withInfo

  const showDetailFiltersIndicator = urlExtra || hasQuickActive

  return (
    <div className="rounded-md border bg-card p-3 sm:p-4">
      <form
        action="/portal/seminovos"
        method="get"
        className="space-y-3"
      >
        {initialValues.stockType === 'lacrado' ? (
          <input type="hidden" name="tipo" value="lacrados" />
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="seminovos-q">Filtro amplo</Label>
            <Input
              id="seminovos-q"
              name="q"
              placeholder="Modelo, cor, IMEI, informações…"
              defaultValue={initialValues.q}
            />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 sm:pb-0.5">
            <Button type="submit" className="touch-manipulation">
              Aplicar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="relative h-10 w-10 touch-manipulation"
              onClick={() => setExtraOpen((v) => !v)}
              aria-expanded={extraOpen}
              aria-controls="seminovos-extra-filters"
              aria-label={
                extraOpen
                  ? 'Ocultar filtros detalhados'
                  : 'Abrir filtros detalhados'
              }
            >
              <SlidersHorizontal className="h-4 w-4" />
              {showDetailFiltersIndicator ? (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary"
                  aria-hidden
                />
              ) : null}
            </Button>
          </div>
        </div>

        <Collapsible open={extraOpen} onOpenChange={setExtraOpen}>
          <CollapsibleContent
            id="seminovos-extra-filters"
            forceMount
            className="overflow-hidden data-[state=closed]:hidden"
          >
            <div className="grid gap-4 border-t border-border/60 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

              <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={quickFilters.notTested ? 'default' : 'outline'}
                    onClick={quickFilters.onToggleNotTested}
                  >
                    Não testados
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={quickFilters.notAdvertised ? 'default' : 'outline'}
                    onClick={quickFilters.onToggleNotAdvertised}
                  >
                    Não anunciados
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={quickFilters.noLabel ? 'default' : 'outline'}
                    onClick={quickFilters.onToggleNoLabel}
                  >
                    Sem etiqueta
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={quickFilters.withInfo ? 'default' : 'outline'}
                    onClick={quickFilters.onToggleWithInfo}
                  >
                    Com informação
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" asChild>
                    <Link
                      href={
                        initialValues.stockType === 'lacrado'
                          ? '/portal/seminovos?tipo=lacrados'
                          : '/portal/seminovos'
                      }
                    >
                      Limpar filtros
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </form>
    </div>
  )
}
