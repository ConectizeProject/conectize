'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { suggestedSaleCents } from '@/lib/pricing/suggested-sale-cents'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'

type BulkMetaItem =
  | { id: string; missing: true }
  | {
    id: string
    missing: false
    name: string
    kind: string | null
    salePriceCents: number | null
    costPriceCents: number | null
    pricingTagId: string | null
    deviceModelIds: string[]
  }

type PricingTagRow = {
  id: string
  name: string
  margin_bps: number | null
  min_suggested_sale_cents: number | null
}

type DeviceCatalogRow = {
  id: string
  brand: string | null
  device_type: string | null
  model: string | null
}

type RowValues = {
  tag: string
  model: string
  saleMasked: string
}

function formatBrl (cents: number | null) {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseMaskedMoneyToCents (raw: string): number | null | 'invalid' {
  const t = raw.trim()
  if (!t) return null
  const c = moneyToCentsFromMasked(t)
  if (c === null) return null
  if (c < 0) return 'invalid'
  return c
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productIds: string[]
  allowDeviceModel: boolean
  onSuccess: () => void
}

export function BulkEditProductsModal ({
  open,
  onOpenChange,
  productIds,
  allowDeviceModel,
  onSuccess,
}: Props) {
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [items, setItems] = useState<BulkMetaItem[]>([])
  const [pricingTags, setPricingTags] = useState<PricingTagRow[]>([])
  const [rowStates, setRowStates] = useState<Record<string, RowValues>>({})
  const [initialRowStates, setInitialRowStates] = useState<Record<string, RowValues>>({})
  const [deviceCatalog, setDeviceCatalog] = useState<DeviceCatalogRow[]>([])
  const [deviceCatalogLoading, setDeviceCatalogLoading] = useState(false)

  const [templateTag, setTemplateTag] = useState('__keep__')
  const [templateModelAction, setTemplateModelAction] = useState<'keep' | 'clear' | 'replace'>('keep')
  const [templateCompatibleModel, setTemplateCompatibleModel] = useState<{ id: string; label: string } | null>(null)
  const [templateDeviceQuery, setTemplateDeviceQuery] = useState('')
  const [templateSuggestions, setTemplateSuggestions] = useState<{ value: string; label: string }[]>([])
  const templateBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [rowModelQueries, setRowModelQueries] = useState<Record<string, string>>({})
  const [focusedModelRowId, setFocusedModelRowId] = useState<string | null>(null)
  const modelRowBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [templateSaleMasked, setTemplateSaleMasked] = useState('')
  const [templatePriceMode, setTemplatePriceMode] = useState<'fixed' | 'suggested'>('fixed')
  const [submitting, setSubmitting] = useState(false)

  const resetTemplates = useCallback(() => {
    setTemplateTag('__keep__')
    setTemplateModelAction('keep')
    setTemplateCompatibleModel(null)
    setTemplateDeviceQuery('')
    setTemplateSuggestions([])
    setTemplateSaleMasked('')
    setTemplatePriceMode('fixed')
    setFocusedModelRowId(null)
    setRowModelQueries({})
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/portal/staff/pricing-tags')
      const json = await res.json().catch(() => null)
      if (cancelled || !res.ok || !json?.ok) return
      setPricingTags((json.pricingTags || []) as PricingTagRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || !allowDeviceModel) return
    let cancelled = false
    void (async () => {
      setDeviceCatalogLoading(true)
      const res = await fetch('/api/portal/device-models?limit=2000')
      const json = await res.json().catch(() => null)
      if (cancelled || !res.ok || !json?.ok) {
        setDeviceCatalog([])
        setDeviceCatalogLoading(false)
        return
      }
      setDeviceCatalog((json.deviceModels || []) as DeviceCatalogRow[])
      setDeviceCatalogLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, allowDeviceModel])

  useEffect(() => {
    if (!open || productIds.length === 0) return
    let cancelled = false
    void (async () => {
      setLoadingMeta(true)
      resetTemplates()
      const res = await fetch('/api/portal/staff/produtos/bulk-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds }),
      })
      const json = await res.json().catch(() => null)
      if (cancelled) return
      setLoadingMeta(false)
      if (!res.ok || !json?.ok) {
        setItems([])
        setRowStates({})
        setInitialRowStates({})
        toast({
          variant: 'destructive',
          title: 'Não foi possível carregar os itens',
          description: 'Tente novamente.',
        })
        return
      }
      const loaded = (json.items || []) as BulkMetaItem[]
      setItems(loaded)

      const init: Record<string, RowValues> = {}
      for (const it of loaded) {
        if (it.missing !== false) continue
        init[it.id] = {
          tag: '__keep__',
          model: '__keep__',
          saleMasked:
            typeof it.salePriceCents === 'number' ? maskedFromCents(it.salePriceCents) : '',
        }
      }
      setInitialRowStates(init)
      setRowStates({ ...init })
    })()
    return () => {
      cancelled = true
    }
  }, [open, productIds, resetTemplates])

  const deviceOptions = useMemo(
    () =>
      deviceCatalog
        .map((d) => ({
          value: d.id,
          label: [d.brand, d.device_type, d.model].filter(Boolean).join(' ') || d.id,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    [deviceCatalog],
  )

  const labelByModelId = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of deviceOptions) m.set(o.value, o.label)
    return m
  }, [deviceOptions])

  useEffect(() => {
    const q = templateDeviceQuery.trim().toLowerCase()
    if (q.length < 2) {
      setTemplateSuggestions([])
      return
    }
    setTemplateSuggestions(deviceOptions.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 50))
  }, [templateDeviceQuery, deviceOptions])

  const getRowModelSearchResults = useCallback(
    (rowId: string) => {
      const raw = (rowModelQueries[rowId] || '').trim().toLowerCase()
      if (raw.length < 2) return []
      return deviceOptions.filter((o) => o.label.toLowerCase().includes(raw)).slice(0, 50)
    },
    [rowModelQueries, deviceOptions],
  )

  const hasChanges = useMemo(() => {
    for (const id of Object.keys(rowStates)) {
      const a = rowStates[id]
      const b = initialRowStates[id]
      if (!a || !b) continue
      if (a.tag !== b.tag || a.model !== b.model || a.saleMasked !== b.saleMasked) return true
    }
    return false
  }, [rowStates, initialRowStates])

  const suggestionForItem = useCallback(
    (it: Extract<BulkMetaItem, { missing: false }>, row: RowValues): number | null => {
      let tagId: string | null = null
      if (row.tag !== '__keep__' && row.tag !== '__clear__') tagId = row.tag
      else if (row.tag === '__keep__') tagId = it.pricingTagId
      if (!tagId) return null
      const tag = pricingTags.find((t) => t.id === tagId)
      if (!tag) return null
      const margin = tag.margin_bps != null ? Number(tag.margin_bps) : 0
      return suggestedSaleCents({
        costCents: it.costPriceCents,
        marginBps: margin,
        minSuggestedSaleCents: tag.min_suggested_sale_cents,
      })
    },
    [pricingTags],
  )

  function updateRow (id: string, patch: Partial<RowValues>) {
    if (Object.prototype.hasOwnProperty.call(patch, 'model')) {
      setRowModelQueries((q) => {
        const next = { ...q }
        delete next[id]
        return next
      })
    }
    setRowStates((prev) => {
      const cur = prev[id]
      if (!cur) return prev
      const merged = { ...cur, ...patch }
      if (templatePriceMode === 'suggested' && Object.prototype.hasOwnProperty.call(patch, 'tag')) {
        const it = items.find(
          (x): x is Extract<BulkMetaItem, { missing: false }> => !x.missing && x.id === id,
        )
        if (it) {
          const sugg = suggestionForItem(it, merged)
          if (sugg != null) merged.saleMasked = maskedFromCents(sugg)
        }
      }
      return { ...prev, [id]: merged }
    })
  }

  function applyTagToAllRows (tag: string) {
    setRowStates((prev) => {
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        next[id] = { ...next[id], tag }
      }
      return next
    })
  }

  function applyModelToAllRows (modelVal: string) {
    setRowModelQueries({})
    setRowStates((prev) => {
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        next[id] = { ...next[id], model: modelVal }
      }
      return next
    })
  }

  function applySaleToAllRows (masked: string) {
    setRowStates((prev) => {
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        next[id] = { ...next[id], saleMasked: masked }
      }
      return next
    })
  }

  function pickTemplateModel (opt: { value: string; label: string }) {
    setTemplateCompatibleModel({ id: opt.value, label: opt.label })
    setTemplateModelAction('replace')
    setTemplateDeviceQuery('')
    setTemplateSuggestions([])
    applyModelToAllRows(opt.value)
  }

  useEffect(() => {
    if (!open || loadingMeta || templatePriceMode !== 'suggested') return
    setRowStates((prev) => {
      let changed = false
      const next = { ...prev }
      for (const it of items) {
        if (it.missing !== false) continue
        const row = prev[it.id]
        if (!row) continue
        const sugg = suggestionForItem(it, row)
        if (sugg == null) continue
        const masked = maskedFromCents(sugg)
        if (row.saleMasked === masked) continue
        next[it.id] = { ...row, saleMasked: masked }
        changed = true
      }
      return changed ? next : prev
    })
  }, [
    open,
    loadingMeta,
    templatePriceMode,
    templateTag,
    items,
    suggestionForItem,
  ])

  function tagLabelForRow (
    it: Extract<BulkMetaItem, { missing: false }>,
    row: RowValues,
  ): string {
    if (row.tag !== '__keep__' && row.tag !== '__clear__') {
      return pricingTags.find((t) => t.id === row.tag)?.name || 'Tag'
    }
    if (it.pricingTagId) {
      return pricingTags.find((t) => t.id === it.pricingTagId)?.name || '—'
    }
    return 'Sem tag'
  }

  async function handleSubmit () {
    if (!hasChanges) {
      toast({
        variant: 'destructive',
        title: 'Nada para aplicar',
        description: 'Altere ao menos um campo em alguma linha.',
      })
      return
    }

    const okItems = items.filter((it): it is Extract<BulkMetaItem, { missing: false }> => !it.missing)
    if (okItems.length === 0) {
      toast({ variant: 'destructive', title: 'Nenhum item válido' })
      return
    }

    for (const it of okItems) {
      const cur = rowStates[it.id]
      const ini = initialRowStates[it.id]
      if (!cur || !ini) continue
      const saleParsed = parseMaskedMoneyToCents(cur.saleMasked)
      if (saleParsed === 'invalid') {
        toast({
          variant: 'destructive',
          title: 'Preço inválido',
          description: `Verifique o valor de venda em «${it.name}».`,
        })
        return
      }
    }

    setSubmitting(true)
    let ok = 0
    let fail = 0

    try {
      for (const it of okItems) {
        const cur = rowStates[it.id]
        const ini = initialRowStates[it.id]
        if (!cur || !ini) continue

        if (cur.tag === ini.tag && cur.model === ini.model && cur.saleMasked === ini.saleMasked) {
          continue
        }

        const body: Record<string, unknown> = {}

        if (cur.tag !== ini.tag) {
          if (cur.tag === '__clear__') body.pricingTagId = null
          else if (cur.tag !== '__keep__') body.pricingTagId = cur.tag
        }

        if (allowDeviceModel && cur.model !== ini.model) {
          if (cur.model === '__clear__') body.compatibleModelIds = []
          else if (cur.model !== '__keep__') body.compatibleModelIds = [cur.model]
        }

        const curCents = parseMaskedMoneyToCents(cur.saleMasked)
        const iniCents = parseMaskedMoneyToCents(ini.saleMasked)
        if (curCents === 'invalid') {
          fail++
          continue
        }
        if (curCents !== iniCents) {
          body.salePrice = (curCents === null ? 0 : curCents) / 100
        }

        if (Object.keys(body).length === 0) {
          continue
        }

        const res = await fetch(`/api/portal/produtos/${it.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => null)
        if (res.ok && data?.ok) ok++
        else fail++
      }

      toast({
        variant: fail > 0 ? 'default' : 'success',
        title: 'Edição em massa',
        description: `${ok} atualizado${ok === 1 ? '' : 's'}${fail > 0 ? `, ${fail} falha(s)` : ''}.`,
      })

      if (ok > 0) {
        onSuccess()
        onOpenChange(false)
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao salvar' })
    } finally {
      setSubmitting(false)
    }
  }

  const nOk = items.filter((it) => !it.missing).length
  const nMissing = items.filter((it) => it.missing).length

  const tableRows = useMemo(
    () => items.filter((it): it is Extract<BulkMetaItem, { missing: false }> => !it.missing),
    [items],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,900px)] w-[min(96vw,1180px)] max-w-[min(96vw,1180px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1180px)]">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4">
          <DialogTitle>Editar em massa</DialogTitle>
          <DialogDescription>
            {productIds.length} selecionado
            {productIds.length === 1 ? '' : 's'}
            {nMissing > 0 ? ` (${nMissing} não encontrado${nMissing === 1 ? '' : 's'} na base)` : ''}
            . Tag e modelo replicam ao selecionar. Preço: valor fixo (replica ao sair do campo) ou valor sugerido pela tag/custo.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">
          {loadingMeta ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Carregando dados…
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col gap-4">
              <div
                className={cn(
                  'grid shrink-0 grid-cols-1 gap-4 border-b border-border/60 pb-4 lg:gap-6',
                  allowDeviceModel ? 'lg:grid-cols-3' : 'lg:grid-cols-2',
                )}
              >
                <div className="space-y-2">
                  <Label htmlFor="bulk-template-tag">Tag</Label>
                  <Select
                    value={templateTag}
                    onValueChange={(v) => {
                      setTemplateTag(v)
                      applyTagToAllRows(v)
                    }}
                    disabled={submitting}
                  >
                    <SelectTrigger id="bulk-template-tag" className="w-full">
                      <SelectValue placeholder="Modelo para linhas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep__">Manter atual (cada linha)</SelectItem>
                      <SelectItem value="__clear__">Remover tag</SelectItem>
                      {pricingTags.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {allowDeviceModel ? (
                  <div className="space-y-2">
                    <Label htmlFor="bulk-template-model">Modelo</Label>
                    <Select
                      value={templateModelAction}
                      onValueChange={(v) => {
                        const next = v as 'keep' | 'clear' | 'replace'
                        if (next === 'keep') {
                          setTemplateCompatibleModel(null)
                          setTemplateDeviceQuery('')
                          setTemplateModelAction('keep')
                          applyModelToAllRows('__keep__')
                          return
                        }
                        if (next === 'clear') {
                          setTemplateCompatibleModel(null)
                          setTemplateDeviceQuery('')
                          setTemplateModelAction('clear')
                          applyModelToAllRows('__clear__')
                          return
                        }
                        setTemplateModelAction('replace')
                        setTemplateCompatibleModel(null)
                        setTemplateDeviceQuery('')
                      }}
                      disabled={submitting || deviceCatalogLoading}
                    >
                      <SelectTrigger id="bulk-template-model" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keep">Manter atual</SelectItem>
                        <SelectItem value="clear">Remover modelo</SelectItem>
                        <SelectItem value="replace">Definir via busca</SelectItem>
                      </SelectContent>
                    </Select>
                    {templateModelAction === 'replace' ? (
                      templateCompatibleModel ? (
                        <div className="flex min-h-9 items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-2 py-1.5 text-xs">
                          <span className="min-w-0 flex-1 truncate">{templateCompatibleModel.label}</span>
                          <button
                            type="button"
                            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-background"
                            onClick={() => setTemplateCompatibleModel(null)}
                            aria-label="Limpar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Input
                            placeholder="Buscar (mín. 2 caracteres)…"
                            value={templateDeviceQuery}
                            onChange={(e) => setTemplateDeviceQuery(e.target.value)}
                            onBlur={() => {
                              templateBlurRef.current = setTimeout(() => setTemplateSuggestions([]), 150)
                            }}
                            onFocus={() => {
                              if (templateBlurRef.current) {
                                clearTimeout(templateBlurRef.current)
                                templateBlurRef.current = null
                              }
                            }}
                            disabled={submitting || deviceCatalogLoading}
                            className="h-9 text-sm"
                            autoComplete="off"
                          />
                          {templateSuggestions.length > 0 ? (
                            <ul className="absolute z-40 mt-1 max-h-36 w-full list-none overflow-auto rounded-md border bg-popover py-1 shadow-md">
                              {templateSuggestions.map((opt) => (
                                <li key={opt.value}>
                                  <button
                                    type="button"
                                    className="w-full px-2 py-1.5 text-left text-xs hover:bg-muted"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => pickTemplateModel(opt)}
                                  >
                                    {opt.label}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      )
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <Label>Preço de venda</Label>
                  <RadioGroup
                    value={templatePriceMode}
                    onValueChange={(v) => setTemplatePriceMode(v as 'fixed' | 'suggested')}
                    className="grid gap-2"
                    disabled={submitting}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fixed" id="bulk-price-fixed" />
                      <Label htmlFor="bulk-price-fixed" className="cursor-pointer font-normal">
                        Valor fixo
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="suggested" id="bulk-price-suggested" />
                      <Label htmlFor="bulk-price-suggested" className="cursor-pointer font-normal">
                        Valor sugerido (custo × tag)
                      </Label>
                    </div>
                  </RadioGroup>
                  {templatePriceMode === 'fixed' ? (
                    <>
                      <Input
                        id="bulk-template-sale"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="0,00"
                        value={templateSaleMasked}
                        onChange={(e) => setTemplateSaleMasked(formatMoneyInput(e.target.value))}
                        onBlur={() => applySaleToAllRows(templateSaleMasked)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur()
                          }
                        }}
                        className="h-9 tabular-nums"
                        disabled={submitting}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Replica para todas as linhas ao sair do campo ou ao pressionar Enter.
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Preenche a coluna Venda com o sugerido de cada item (margem da tag da linha ou tag atual do
                      produto quando a linha está em &quot;Manter&quot;). Ajuste as tags acima ou por linha na
                      tabela.
                    </p>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Itens — edite cada coluna</p>
                <ScrollArea className="h-[min(48vh,420px)] rounded-md border">
                  <table className="w-full min-w-[800px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                        <th className="sticky top-0 z-10 min-w-[9rem] px-2 py-2 font-medium">Produto</th>
                        <th className="sticky top-0 z-10 min-w-[10rem] px-2 py-2 font-medium">Tag</th>
                        {allowDeviceModel ? (
                          <th className="sticky top-0 z-10 min-w-[11rem] px-2 py-2 font-medium">Modelo</th>
                        ) : null}
                        <th className="sticky top-0 z-10 min-w-[7rem] px-2 py-2 font-medium">Venda</th>
                        <th className="sticky top-0 z-10 w-24 px-2 py-2 font-medium">Sg.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((it) => {
                        const row = rowStates[it.id]
                        if (!row) return null
                        const sugg = suggestionForItem(it, row)
                        const currentModelId = it.deviceModelIds[0]
                        const currentModelLabel =
                          currentModelId ? labelByModelId.get(currentModelId) || '—' : '—'

                        return (
                          <tr key={it.id} className="border-b border-border/60 align-top hover:bg-muted/20">
                            <td className="max-w-[14rem] px-2 py-2">
                              <span className="line-clamp-2 font-medium leading-tight" title={it.name}>
                                {it.name}
                              </span>
                            </td>
                            <td className="px-1 py-1.5">
                              <Select
                                value={row.tag}
                                onValueChange={(v) => updateRow(it.id, { tag: v })}
                                disabled={submitting}
                              >
                                <SelectTrigger className="h-9 max-w-[200px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__keep__">
                                    Manter (
                                    {tagLabelForRow(it, row)}
                                    )
                                  </SelectItem>
                                  <SelectItem value="__clear__">Remover tag</SelectItem>
                                  {pricingTags.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            {allowDeviceModel ? (
                              <td className="px-1 py-1.5">
                                <div className="relative min-w-[12rem] max-w-[280px]">
                                  <Input
                                    value={
                                      Object.prototype.hasOwnProperty.call(rowModelQueries, it.id)
                                        ? rowModelQueries[it.id]
                                        : row.model === '__keep__' || row.model === '__clear__'
                                          ? ''
                                          : (labelByModelId.get(row.model) ?? '')
                                    }
                                    placeholder={
                                      row.model === '__keep__'
                                        ? `Manter: ${currentModelLabel}`
                                        : 'Buscar aparelho (mín. 2 caracteres)…'
                                    }
                                    onChange={(e) =>
                                      setRowModelQueries((q) => ({
                                        ...q,
                                        [it.id]: e.target.value,
                                      }))}
                                    onFocus={(e) => {
                                      if (modelRowBlurRef.current) {
                                        clearTimeout(modelRowBlurRef.current)
                                        modelRowBlurRef.current = null
                                      }
                                      setFocusedModelRowId(it.id)
                                      if (
                                        row.model !== '__keep__'
                                        && row.model !== '__clear__'
                                        && !Object.prototype.hasOwnProperty.call(rowModelQueries, it.id)
                                      ) {
                                        e.currentTarget.select()
                                      }
                                    }}
                                    onBlur={() => {
                                      modelRowBlurRef.current = setTimeout(() => {
                                        setFocusedModelRowId(null)
                                        modelRowBlurRef.current = null
                                      }, 200)
                                    }}
                                    disabled={submitting}
                                    className="h-9 text-xs"
                                    autoComplete="off"
                                  />
                                  {focusedModelRowId === it.id ? (
                                    <ul className="absolute z-50 mt-1 max-h-52 w-full list-none overflow-auto rounded-md border bg-popover py-1 shadow-md">
                                      <li>
                                        <button
                                          type="button"
                                          className="w-full px-2 py-1.5 text-left text-[11px] hover:bg-muted"
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => {
                                            updateRow(it.id, { model: '__keep__' })
                                            setFocusedModelRowId(null)
                                          }}
                                        >
                                          Manter atual (
                                          {currentModelLabel}
                                          )
                                        </button>
                                      </li>
                                      <li>
                                        <button
                                          type="button"
                                          className="w-full px-2 py-1.5 text-left text-[11px] hover:bg-muted"
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => {
                                            updateRow(it.id, { model: '__clear__' })
                                            setFocusedModelRowId(null)
                                          }}
                                        >
                                          Remover modelo
                                        </button>
                                      </li>
                                      {(rowModelQueries[it.id] || '').trim().length >= 2
                                        ? getRowModelSearchResults(it.id).map((opt) => (
                                          <li key={opt.value}>
                                            <button
                                              type="button"
                                              className="w-full px-2 py-1.5 text-left text-[11px] hover:bg-muted"
                                              onMouseDown={(e) => e.preventDefault()}
                                              onClick={() => {
                                                updateRow(it.id, { model: opt.value })
                                                setFocusedModelRowId(null)
                                              }}
                                            >
                                              {opt.label}
                                            </button>
                                          </li>
                                        ))
                                        : null}
                                    </ul>
                                  ) : null}
                                </div>
                              </td>
                            ) : null}
                            <td className="px-1 py-1.5">
                              <Input
                                inputMode="numeric"
                                autoComplete="off"
                                placeholder="0,00"
                                value={row.saleMasked}
                                onChange={(e) =>
                                  updateRow(it.id, { saleMasked: formatMoneyInput(e.target.value) })}
                                className="h-9 w-[7.5rem] tabular-nums text-xs"
                                disabled={submitting}
                              />
                            </td>
                            <td className="px-2 py-2 text-xs tabular-nums text-muted-foreground">
                              {formatBrl(sugg)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || loadingMeta || nOk === 0 || !hasChanges}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aplicando…
              </>
            ) : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
