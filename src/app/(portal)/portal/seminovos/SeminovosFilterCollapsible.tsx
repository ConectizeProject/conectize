'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { revendaPath } from '@/lib/revenda/revenda-paths'
import { formatDateBr } from '@/lib/utils/format-date'
import { formatMoneyInput } from '@/lib/utils/money'

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

function CatalogPriceRangeFields ({
  initialMin,
  initialMax,
}: {
  initialMin: string
  initialMax: string
}) {
  const [valueMin, setValueMin] = useState(initialMin)
  const [valueMax, setValueMax] = useState(initialMax)

  useEffect(() => {
    setValueMin(initialMin)
    setValueMax(initialMax)
  }, [initialMin, initialMax])

  return (
    <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2 lg:col-span-3 xl:col-span-4">
      <div className="space-y-2">
        <Label htmlFor="revenda-valueMin">Valor de (R$)</Label>
        <Input
          id="revenda-valueMin"
          name="valueMin"
          inputMode="numeric"
          autoComplete="off"
          value={valueMin}
          onChange={(e) => setValueMin(formatMoneyInput(e.target.value))}
          placeholder="0,00"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="revenda-valueMax">Valor até (R$)</Label>
        <Input
          id="revenda-valueMax"
          name="valueMax"
          inputMode="numeric"
          autoComplete="off"
          value={valueMax}
          onChange={(e) => setValueMax(formatMoneyInput(e.target.value))}
          placeholder="0,00"
        />
      </div>
    </div>
  )
}

type Props = {
  initialValues: {
    q: string
    condition: string
    storageGb: string
    color: string
    purchaseDateFrom: string
    purchaseDateTo: string
    saleDateFrom?: string
    saleDateTo?: string
    stockType: 'seminovo' | 'lacrado' | 'all'
    deviceName?: string
    /** Catálogo revenda (GET): texto mascarado. */
    valueMin?: string
    valueMax?: string
    /** Catálogo: incluir aparelhos já vendidos. */
    includeSold?: boolean
  }
  /** GET do formulário de filtros (listagem de revenda). */
  filterFormAction: string
  distinctDeviceNames: string[]
  /** Listagem catálogo revenda: sem chips operacionais; `quickFilters` pode ser dummy. */
  catalogMode?: boolean
  /** Exibe opção de incluir vendidos (somente admin no catálogo). */
  showIncludeSoldFilter?: boolean
  /** Conteúdo após Aplicar / filtros detalhados (ex.: toggle na mesma linha). */
  trailingSlot?: ReactNode
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
  /** Filtros ativos fora da URL (ex.: atalhos operacionais na listagem). */
  extraAppliedChips?: { id: string; text: string }[]
  /** Chamado ao clicar em «Limpar todos» (zera também filtros só no cliente). */
  onClearClientFilters?: () => void
}

function seminovosFilterHref (
  basePath: string,
  iv: Props['initialValues'],
  omit: ReadonlySet<string>,
): string {
  const p = new URLSearchParams()
  if (!omit.has('q') && iv.q.trim()) p.set('q', iv.q.trim())
  const dn = (iv.deviceName || '').trim()
  if (!omit.has('deviceName') && dn) p.set('deviceName', dn)
  if (!omit.has('storageGb') && iv.storageGb.trim()) p.set('storageGb', iv.storageGb)
  if (!omit.has('condition') && iv.condition.trim()) p.set('condition', iv.condition)
  if (!omit.has('color') && iv.color.trim()) p.set('color', iv.color)
  if (!omit.has('purchaseDateFrom') && iv.purchaseDateFrom.trim()) {
    p.set('purchaseDateFrom', iv.purchaseDateFrom.trim())
  }
  if (!omit.has('purchaseDateTo') && iv.purchaseDateTo.trim()) {
    p.set('purchaseDateTo', iv.purchaseDateTo.trim())
  }
  const saleFrom = (iv.saleDateFrom || '').trim()
  const saleTo = (iv.saleDateTo || '').trim()
  if (!omit.has('saleDateFrom') && saleFrom) p.set('saleDateFrom', saleFrom)
  if (!omit.has('saleDateTo') && saleTo) p.set('saleDateTo', saleTo)
  const vmin = (iv.valueMin || '').trim()
  const vmax = (iv.valueMax || '').trim()
  if (!omit.has('valueMin') && vmin) p.set('valueMin', vmin)
  if (!omit.has('valueMax') && vmax) p.set('valueMax', vmax)
  if (!omit.has('sold') && iv.includeSold) p.set('sold', '1')
  const qs = p.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

function hasUrlExtraFilters (initialValues: Props['initialValues']) {
  return Boolean(
    (initialValues.deviceName || '').trim() ||
    initialValues.condition ||
    initialValues.storageGb ||
    initialValues.color ||
    initialValues.purchaseDateFrom ||
    initialValues.purchaseDateTo ||
    (initialValues.saleDateFrom || '').trim() ||
    (initialValues.saleDateTo || '').trim() ||
    (initialValues.valueMin || '').trim() ||
    (initialValues.valueMax || '').trim() ||
    initialValues.includeSold,
  )
}

export function SeminovosFilterCollapsible ({
  initialValues,
  filterFormAction,
  distinctDeviceNames,
  catalogMode = false,
  showIncludeSoldFilter = false,
  trailingSlot,
  quickFilters,
  extraAppliedChips = [],
  onClearClientFilters,
}: Props) {
  const router = useRouter()
  const [qInput, setQInput] = useState(initialValues.q)

  useEffect(() => {
    setQInput(initialValues.q)
  }, [initialValues.q])

  const urlExtraChips = useMemo(() => {
    const rows: { id: string; text: string }[] = []
    const dn = (initialValues.deviceName || '').trim()
    if (dn) {
      rows.push({ id: 'deviceName', text: `Modelo: ${dn}` })
    }
    if (initialValues.storageGb.trim()) {
      const label =
        STORAGE_OPTIONS.find((o) => o.value === initialValues.storageGb)?.label ??
        initialValues.storageGb
      rows.push({ id: 'storage', text: `Armazenamento: ${label}` })
    }
    if (initialValues.condition.trim()) {
      const label =
        CONDITION_OPTIONS.find((o) => o.value === initialValues.condition)?.label ??
        initialValues.condition
      rows.push({ id: 'condition', text: `Estado: ${label}` })
    }
    if (initialValues.color.trim()) {
      rows.push({ id: 'color', text: `Cor: ${initialValues.color.trim()}` })
    }
    if (initialValues.purchaseDateFrom.trim()) {
      rows.push({
        id: 'pf',
        text: `Compra a partir de ${formatDateBr(`${initialValues.purchaseDateFrom.trim()}T12:00:00`)}`,
      })
    }
    if (initialValues.purchaseDateTo.trim()) {
      rows.push({
        id: 'pt',
        text: `Compra até ${formatDateBr(`${initialValues.purchaseDateTo.trim()}T12:00:00`)}`,
      })
    }
    const saleFrom = (initialValues.saleDateFrom || '').trim()
    const saleTo = (initialValues.saleDateTo || '').trim()
    if (saleFrom) {
      rows.push({
        id: 'sf',
        text: `Venda a partir de ${formatDateBr(`${saleFrom}T12:00:00`)}`,
      })
    }
    if (saleTo) {
      rows.push({
        id: 'st',
        text: `Venda até ${formatDateBr(`${saleTo}T12:00:00`)}`,
      })
    }
    const vmin = (initialValues.valueMin || '').trim()
    const vmax = (initialValues.valueMax || '').trim()
    if (vmin) rows.push({ id: 'vmin', text: `Valor de: R$ ${vmin}` })
    if (vmax) rows.push({ id: 'vmax', text: `Valor até: R$ ${vmax}` })
    if (initialValues.includeSold) {
      rows.push({ id: 'sold', text: 'Incluir vendidos' })
    }
    return rows
  }, [initialValues])

  const mergedExtraChips = useMemo(
    () => [...urlExtraChips, ...extraAppliedChips],
    [urlExtraChips, extraAppliedChips],
  )

  const showAppliedExtrasRow = mergedExtraChips.length > 0

  const urlExtra = hasUrlExtraFilters(initialValues)
  const [extraOpen, setExtraOpen] = useState(urlExtra)

  const hasQuickActive =
    !catalogMode &&
    (quickFilters.notTested ||
      quickFilters.notAdvertised ||
      quickFilters.noLabel ||
      quickFilters.withInfo)

  const showDetailFiltersIndicator = urlExtra || hasQuickActive

  const clearHref = revendaPath.listagem

  return (
    <div className="rounded-md border bg-card p-3">
      <form action={filterFormAction} method="get">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="relative">
              <Input
                id="seminovos-q"
                name="q"
                placeholder="Modelo, cor, IMEI, informações…"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                aria-label="Busca ampla"
                className={qInput.trim() ? 'pr-10' : undefined}
              />
              {qInput.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    router.push(
                      seminovosFilterHref(filterFormAction, initialValues, new Set(['q'])),
                    )
                  }}
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Limpar busca ampla"
                  title="Limpar busca"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button type="submit" className="h-10 touch-manipulation px-4">
              Aplicar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="relative h-10 w-10 shrink-0 touch-manipulation"
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
            {trailingSlot ? <div className="flex items-center">{trailingSlot}</div> : null}
          </div>
        </div>

        {showAppliedExtrasRow ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/50 pt-2 text-[11px] leading-snug sm:text-xs">
            <span className="mr-0.5 shrink-0 font-medium text-foreground/80">
              Filtros extras:
            </span>
            {mergedExtraChips.map((chip, idx) => (
              <span
                key={`${chip.id}-${idx}`}
                className="max-w-full truncate rounded-md bg-muted/70 px-2 py-0.5 text-muted-foreground"
                title={chip.text}
              >
                {chip.text}
              </span>
            ))}
            <Link
              href={clearHref}
              onClick={() => {
                onClearClientFilters?.()
              }}
              className="ml-auto shrink-0 font-medium text-primary underline-offset-2 hover:underline"
            >
              Limpar todos
            </Link>
          </div>
        ) : null}

        <Collapsible
          open={extraOpen}
          onOpenChange={setExtraOpen}
          className="data-[state=open]:mt-3"
        >
          <CollapsibleContent
            id="seminovos-extra-filters"
            forceMount
            className="overflow-hidden data-[state=closed]:hidden"
          >
            <div className="grid gap-4 border-t border-border/60 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {catalogMode ? (
                <CatalogPriceRangeFields
                  initialMin={initialValues.valueMin || ''}
                  initialMax={initialValues.valueMax || ''}
                />
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="seminovos-deviceName">Modelo</Label>
                <select
                  id="seminovos-deviceName"
                  name="deviceName"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={initialValues.deviceName || ''}
                >
                  <option value="">Todos</option>
                  {distinctDeviceNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
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
              <div className="space-y-2">
                <Label htmlFor="seminovos-saleDateFrom">Venda (de)</Label>
                <Input
                  id="seminovos-saleDateFrom"
                  name="saleDateFrom"
                  type="date"
                  defaultValue={initialValues.saleDateFrom || ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seminovos-saleDateTo">Venda (até)</Label>
                <Input
                  id="seminovos-saleDateTo"
                  name="saleDateTo"
                  type="date"
                  defaultValue={initialValues.saleDateTo || ''}
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 space-y-3">
                {catalogMode && showIncludeSoldFilter ? (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="sold"
                      value="1"
                      defaultChecked={Boolean(initialValues.includeSold)}
                      className="h-4 w-4 rounded border border-input"
                    />
                    <span>Incluir celulares já vendidos</span>
                  </label>
                ) : null}
                {catalogMode ? null : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="h-10 px-3"
                      variant={quickFilters.notTested ? 'default' : 'outline'}
                      onClick={quickFilters.onToggleNotTested}
                    >
                      Não testados
                    </Button>
                    <Button
                      type="button"
                      className="h-10 px-3"
                      variant={quickFilters.notAdvertised ? 'default' : 'outline'}
                      onClick={quickFilters.onToggleNotAdvertised}
                    >
                      Não anunciados
                    </Button>
                    <Button
                      type="button"
                      className="h-10 px-3"
                      variant={quickFilters.noLabel ? 'default' : 'outline'}
                      onClick={quickFilters.onToggleNoLabel}
                    >
                      Sem etiqueta
                    </Button>
                    <Button
                      type="button"
                      className="h-10 px-3"
                      variant={quickFilters.withInfo ? 'default' : 'outline'}
                      onClick={quickFilters.onToggleWithInfo}
                    >
                      Com informação
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" asChild className="h-10 px-4">
                    <Link href={clearHref} className="inline-flex items-center justify-center">
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
