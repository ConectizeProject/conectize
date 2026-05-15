'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildProdutosGestaoHref } from '@/lib/products/portal-gestao-produtos-list'

type GestaoKind = 'product' | 'service' | 'all'

type ProdutosFilterFormProps = {
  initialQ: string
  initialSku: string
  initialBarcode: string
  kind: GestaoKind
  /** Mantém `?tab=gestao` ao filtrar na área staff (abas de produtos). */
  withGestaoTab?: boolean
}

function hasProdutosExtraFilters (sku: string, barcode: string): boolean {
  return Boolean(sku.trim()) || Boolean(barcode.trim())
}

export function ProdutosFilterForm ({
  initialQ,
  initialSku,
  initialBarcode,
  kind,
  withGestaoTab,
}: ProdutosFilterFormProps) {
  const router = useRouter()
  const urlExtras = hasProdutosExtraFilters(initialSku, initialBarcode)
  const showDetailFiltersIndicator = urlExtras || kind !== 'all'
  const [extraOpen, setExtraOpen] = useState(showDetailFiltersIndicator)

  const [qInput, setQInput] = useState(initialQ)
  const [skuDraft, setSkuDraft] = useState(initialSku)
  const [barcodeDraft, setBarcodeDraft] = useState(initialBarcode)
  const [kindDraft, setKindDraft] = useState<GestaoKind>(kind)

  useEffect(() => {
    setQInput(initialQ)
  }, [initialQ])

  useEffect(() => {
    setSkuDraft(initialSku)
  }, [initialSku])

  useEffect(() => {
    setBarcodeDraft(initialBarcode)
  }, [initialBarcode])

  useEffect(() => {
    setKindDraft(kind)
  }, [kind])

  useEffect(() => {
    if (hasProdutosExtraFilters(initialSku, initialBarcode) || kind !== 'all') {
      setExtraOpen(true)
    }
  }, [initialSku, initialBarcode, kind])

  const appliedExtraLabels = useMemo(() => {
    const rows: { id: string; text: string }[] = []
    if (kind === 'product') {
      rows.push({ id: 'kind', text: 'Somente produtos' })
    } else if (kind === 'service') {
      rows.push({ id: 'kind', text: 'Somente serviços' })
    }
    const s = initialSku.trim()
    if (s) rows.push({ id: 'sku', text: `SKU: ${s}` })
    const b = initialBarcode.trim()
    if (b) rows.push({ id: 'barcode', text: `Código de barras: ${b}` })
    return rows
  }, [kind, initialSku, initialBarcode])

  const showExtrasRow = appliedExtraLabels.length > 0

  function handleSubmit (e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const href = buildProdutosGestaoHref({
      q: qInput,
      kind: kindDraft,
      sku: skuDraft.trim() || undefined,
      barcode: barcodeDraft.trim() || undefined,
    })
    router.replace(href)
    router.refresh()
  }

  function clearBroadQ () {
    const href = buildProdutosGestaoHref({
      q: '',
      kind,
      sku: initialSku.trim() || undefined,
      barcode: initialBarcode.trim() || undefined,
    })
    router.replace(href)
    router.refresh()
  }

  function clearAllFilters () {
    const href = withGestaoTab ? '/portal/produtos?tab=gestao' : '/portal/produtos'
    router.replace(href)
    router.refresh()
  }

  const hasQ = qInput.trim().length > 0

  return (
    <div className="rounded-md border bg-card p-3">
      <form onSubmit={handleSubmit} className="space-y-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="relative">
              <Input
                id="produtos-q"
                name="q"
                placeholder="Busca ampla: nome, SKU ou código de barras (várias palavras)…"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                aria-label="Busca ampla no catálogo"
                className={hasQ ? 'pr-10' : undefined}
              />
              {hasQ ? (
                <button
                  type="button"
                  onClick={clearBroadQ}
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
              Filtrar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="relative h-10 w-10 shrink-0 touch-manipulation"
              onClick={() => setExtraOpen((v) => !v)}
              aria-expanded={extraOpen}
              aria-controls="produtos-extra-filters"
              aria-label={extraOpen ? 'Ocultar mais filtros' : 'Abrir mais filtros'}
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

        {showExtrasRow ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/50 pt-2 text-[11px] leading-snug sm:text-xs">
            <span className="mr-0.5 shrink-0 font-medium text-foreground/80">Filtros extras:</span>
            {appliedExtraLabels.map((chip) => (
              <span
                key={chip.id}
                className="max-w-full truncate rounded-md bg-muted/70 px-2 py-0.5 text-muted-foreground"
                title={chip.text}
              >
                {chip.text}
              </span>
            ))}
            <Link
              href={withGestaoTab ? '/portal/produtos?tab=gestao' : '/portal/produtos'}
              className="ml-auto shrink-0 font-medium text-primary underline-offset-2 hover:underline"
              onClick={(e) => {
                e.preventDefault()
                clearAllFilters()
              }}
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
            id="produtos-extra-filters"
            forceMount
            className="overflow-hidden data-[state=closed]:hidden"
          >
            <div className="space-y-4 border-t border-border/60 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="produtos-kind-filter">Tipo de item</Label>
                  <select
                    id="produtos-kind-filter"
                    name="kind"
                    value={kindDraft}
                    onChange={(e) => setKindDraft(e.target.value as GestaoKind)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="all">Produtos e serviços</option>
                    <option value="product">Somente produtos</option>
                    <option value="service">Somente serviços</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="produtos-sku">SKU</Label>
                  <Input
                    id="produtos-sku"
                    name="sku"
                    placeholder="Ex.: ABC-123"
                    value={skuDraft}
                    onChange={(e) => setSkuDraft(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="produtos-barcode">Código de barras</Label>
                  <Input
                    id="produtos-barcode"
                    name="barcode"
                    placeholder="EAN, UPC ou interno"
                    value={barcodeDraft}
                    onChange={(e) => setBarcodeDraft(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div>
                <Button type="button" variant="outline" asChild>
                  <Link
                    href={withGestaoTab ? '/portal/produtos?tab=gestao' : '/portal/produtos'}
                    onClick={(e) => {
                      e.preventDefault()
                      clearAllFilters()
                    }}
                  >
                    Limpar filtros
                  </Link>
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </form>
    </div>
  )
}
