'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  /** Lista explícita de IDs de `device_models` (mesmo contrato do cadastro do produto). */
  modelIds: string[]
  saleMasked: string
}

function uniqModelIds (ids: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function sortedModelIds (ids: string[]) {
  return [...ids].sort()
}

function sameModelIdSet (a: string[], b: string[]) {
  const sa = sortedModelIds(a)
  const sb = sortedModelIds(b)
  if (sa.length !== sb.length) return false
  return sa.every((v, i) => v === sb[i])
}

function deviceRowToLabel (d: DeviceCatalogRow) {
  return [d.brand, d.device_type, d.model].filter(Boolean).join(' ') || d.id
}

function shortModelId (id: string) {
  return id.length > 14 ? `${id.slice(0, 8)}…` : id
}

type BulkDeviceModelsPickerProps = {
  value: string[]
  onChange: (ids: string[]) => void
  labels: Record<string, string>
  mergeLabelsFromRows: (rows: DeviceCatalogRow[]) => void
  disabled?: boolean
  /** Lista original do cadastro (atalho Restaurar). */
  baselineIds?: string[]
  /** Prefixo único para ids de checkbox (várias linhas na tabela). */
  instanceId?: string
}

function BulkDeviceModelsPicker ({
  value,
  onChange,
  labels,
  mergeLabelsFromRows,
  disabled,
  baselineIds,
  instanceId = 'dm',
}: BulkDeviceModelsPickerProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [hits, setHits] = useState<DeviceCatalogRow[]>([])
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 280)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!open) return
    const token = debounced
    if (token.length < 2) {
      setHits([])
      return
    }
    let cancelled = false
    setFetching(true)
    void (async () => {
      const res = await fetch(
        `/api/portal/device-models?q=${encodeURIComponent(token)}&limit=120`,
      )
      const json = await res.json().catch(() => null)
      if (cancelled) return
      setFetching(false)
      const rows = (json?.ok ? json.deviceModels : []) as DeviceCatalogRow[]
      mergeLabelsFromRows(rows)
      setHits(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [debounced, open, mergeLabelsFromRows])

  const selectedNotInHits = useMemo(
    () => value.filter((id) => !hits.some((h) => h.id === id)),
    [value, hits],
  )

  function toggle (id: string) {
    if (value.includes(id)) onChange(value.filter((x) => x !== id))
    else onChange([...value, id])
  }

  return (
    <Popover
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQ('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full max-w-[11rem] justify-between gap-1 px-2 font-normal"
          disabled={disabled}
        >
          <span className="min-w-0 truncate text-left text-xs">
            {value.length === 0
              ? 'Nenhum'
              : value.length === 1
                ? (labels[value[0]] || shortModelId(value[0]))
                : `${value.length} modelos`}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[130] w-[min(96vw,18rem)] p-0"
        align="start"
        sideOffset={4}
        collisionPadding={12}
      >
        <div className="flex gap-1 border-b px-2 py-1.5">
          {baselineIds ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 flex-1 px-1 text-[11px]"
                onClick={() => onChange([...baselineIds])}
              >
                Restaurar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 flex-1 px-1 text-[11px]"
                onClick={() => onChange([])}
              >
                Limpar
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-1 text-[11px]"
              onClick={() => onChange([])}
            >
              Limpar seleção
            </Button>
          )}
        </div>
        <div className="p-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="h-8 text-xs"
            autoComplete="off"
          />
          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
            Digite 2+ caracteres. Marque ou desmarque na lista.
          </p>
        </div>
        <div className="max-h-44 overflow-y-auto border-t px-1 py-1">
          {fetching ? (
            <div className="flex justify-center py-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            </div>
          ) : null}
          {!fetching && debounced.length >= 2 && hits.length === 0 ? (
            <p className="px-2 py-2 text-center text-[11px] text-muted-foreground">Nenhum resultado</p>
          ) : null}
          {selectedNotInHits.map((id) => {
            const lab = labels[id] || shortModelId(id)
            const cbId = `${instanceId}-sel-${id}`
            return (
              <div key={`sel-${id}`} className="flex items-start gap-2 px-2 py-1.5 hover:bg-muted">
                <Checkbox
                  id={cbId}
                  checked
                  className="mt-0.5"
                  onCheckedChange={() => toggle(id)}
                />
                <label htmlFor={cbId} className="cursor-pointer text-[11px] leading-snug">
                  {lab}
                </label>
              </div>
            )
          })}
          {hits.map((row) => {
            const lab = labels[row.id] || deviceRowToLabel(row)
            const checked = value.includes(row.id)
            const cbId = `${instanceId}-hit-${row.id}`
            return (
              <div key={row.id} className="flex items-start gap-2 px-2 py-1.5 hover:bg-muted">
                <Checkbox
                  id={cbId}
                  checked={checked}
                  className="mt-0.5"
                  onCheckedChange={() => toggle(row.id)}
                />
                <label htmlFor={cbId} className="cursor-pointer text-[11px] leading-snug">
                  {lab}
                </label>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
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
  const [modelLabels, setModelLabels] = useState<Record<string, string>>({})

  const [templateTag, setTemplateTag] = useState('__keep__')
  const [templateModelAction, setTemplateModelAction] = useState<'keep' | 'clear' | 'replace'>('keep')
  const [templateModelIds, setTemplateModelIds] = useState<string[]>([])

  const [templateSaleMasked, setTemplateSaleMasked] = useState('')
  const [templatePriceMode, setTemplatePriceMode] = useState<'fixed' | 'suggested'>('fixed')
  const [submitting, setSubmitting] = useState(false)

  const resetTemplates = useCallback(() => {
    setTemplateTag('__keep__')
    setTemplateModelAction('keep')
    setTemplateModelIds([])
    setTemplateSaleMasked('')
    setTemplatePriceMode('fixed')
  }, [])

  const mergeLabelsFromRows = useCallback((rows: DeviceCatalogRow[]) => {
    setModelLabels((prev) => {
      const next = { ...prev }
      for (const d of rows) {
        next[d.id] = deviceRowToLabel(d)
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      resetTemplates()
      setModelLabels({})
      setLoadingMeta(productIds.length > 0)

      const metaReq =
        productIds.length > 0
          ? fetch('/api/portal/staff/produtos/bulk-meta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds }),
          })
          : Promise.resolve(
            new Response(JSON.stringify({ ok: true, items: [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )

      const [tagsRes, metaRes] = await Promise.all([
        fetch('/api/portal/staff/pricing-tags'),
        metaReq,
      ])

      const [tagsJson, metaJson] = await Promise.all([
        tagsRes.json().catch(() => null),
        metaRes.json().catch(() => null),
      ])

      if (cancelled) return

      if (tagsRes.ok && tagsJson?.ok) {
        setPricingTags((tagsJson.pricingTags || []) as PricingTagRow[])
      } else {
        setPricingTags([])
      }

      setLoadingMeta(false)
      if (!metaRes.ok || !metaJson?.ok) {
        setItems([])
        setRowStates({})
        setInitialRowStates({})
        if (productIds.length > 0) {
          toast({
            variant: 'destructive',
            title: 'Não foi possível carregar os itens',
            description: 'Tente novamente.',
          })
        }
        return
      }
      const loaded = (metaJson.items || []) as BulkMetaItem[]
      setItems(loaded)

      const init: Record<string, RowValues> = {}
      for (const it of loaded) {
        if (it.missing !== false) continue
        init[it.id] = {
          tag: '__keep__',
          modelIds: uniqModelIds(it.deviceModelIds || []),
          saleMasked:
            typeof it.salePriceCents === 'number' ? maskedFromCents(it.salePriceCents) : '',
        }
      }
      setInitialRowStates(init)
      setRowStates({ ...init })

      const idSet = new Set<string>()
      for (const row of loaded) {
        if (row.missing !== false) continue
        for (const mid of row.deviceModelIds || []) idSet.add(mid)
      }
      const idArr = [...idSet]
      if (allowDeviceModel && idArr.length > 0 && !cancelled) {
        const lr = await fetch(
          `/api/portal/device-models?ids=${encodeURIComponent(idArr.join(','))}`,
        )
        const lj = await lr.json().catch(() => null)
        if (!cancelled && lr.ok && lj?.ok && Array.isArray(lj.deviceModels)) {
          const rows = lj.deviceModels as DeviceCatalogRow[]
          setModelLabels((prev) => {
            const next = { ...prev }
            for (const d of rows) {
              next[d.id] = deviceRowToLabel(d)
            }
            return next
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, productIds, allowDeviceModel, resetTemplates])

  const hasChanges = useMemo(() => {
    for (const id of Object.keys(rowStates)) {
      const a = rowStates[id]
      const b = initialRowStates[id]
      if (!a || !b) continue
      if (
        a.tag !== b.tag
        || !sameModelIdSet(a.modelIds, b.modelIds)
        || a.saleMasked !== b.saleMasked
      ) {
        return true
      }
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

  function syncAllRowsToTemplateIds (ids: string[]) {
    const clean = uniqModelIds(ids)
    setRowStates((prev) => {
      const next = { ...prev }
      for (const k of Object.keys(next)) {
        next[k] = { ...next[k], modelIds: [...clean] }
      }
      return next
    })
  }

  function applyModelKeepToAllRows () {
    setRowStates((prev) => {
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        const ini = initialRowStates[id]
        if (ini) next[id] = { ...next[id], modelIds: [...ini.modelIds] }
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

    const patchItems: Array<Record<string, unknown>> = []

    for (const it of okItems) {
      const cur = rowStates[it.id]
      const ini = initialRowStates[it.id]
      if (!cur || !ini) continue

      if (
        cur.tag === ini.tag
        && sameModelIdSet(cur.modelIds, ini.modelIds)
        && cur.saleMasked === ini.saleMasked
      ) {
        continue
      }

      const body: Record<string, unknown> = { productId: it.id }

      if (cur.tag !== ini.tag) {
        if (cur.tag === '__clear__') body.pricingTagId = null
        else if (cur.tag !== '__keep__') body.pricingTagId = cur.tag
      }

      if (allowDeviceModel && !sameModelIdSet(cur.modelIds, ini.modelIds)) {
        body.compatibleModelIds = cur.modelIds
      }

      const curCents = parseMaskedMoneyToCents(cur.saleMasked)
      const iniCents = parseMaskedMoneyToCents(ini.saleMasked)
      if (curCents === 'invalid') {
        continue
      }
      if (curCents !== iniCents) {
        body.salePrice = (curCents === null ? 0 : curCents) / 100
      }

      if (Object.keys(body).length <= 1) {
        continue
      }

      patchItems.push(body)
    }

    if (patchItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nada para aplicar',
        description: 'Altere ao menos um campo em alguma linha.',
      })
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/portal/staff/produtos/bulk-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: patchItems }),
      })
      const data = await res.json().catch(() => null)
      const ok = typeof data?.updated === 'number' ? data.updated : 0
      const fail = typeof data?.failed === 'number' ? data.failed : patchItems.length

      if (!res.ok || !data?.ok) {
        toast({
          variant: 'destructive',
          title: 'Erro ao salvar',
          description: String(data?.error || 'Tente novamente.'),
        })
        return
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
            . Tag e modelos compatíveis podem ser replicados pelo modelo acima. Preço: valor fixo (replica ao sair do campo) ou valor sugerido pela tag/custo.
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
                  <Label htmlFor="bulk-template-tag">Tag de precificação</Label>
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
                    <Label htmlFor="bulk-template-model">Modelos compatíveis</Label>
                    <Select
                      value={templateModelAction}
                      onValueChange={(v) => {
                        const next = v as 'keep' | 'clear' | 'replace'
                        if (next === 'keep') {
                          setTemplateModelIds([])
                          setTemplateModelAction('keep')
                          applyModelKeepToAllRows()
                          return
                        }
                        if (next === 'clear') {
                          setTemplateModelIds([])
                          setTemplateModelAction('clear')
                          syncAllRowsToTemplateIds([])
                          return
                        }
                        setTemplateModelAction('replace')
                        setTemplateModelIds([])
                      }}
                      disabled={submitting}
                    >
                      <SelectTrigger id="bulk-template-model" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keep">Manter cadastro de cada produto</SelectItem>
                        <SelectItem value="clear">Remover todos os modelos</SelectItem>
                        <SelectItem value="replace">Mesma lista em todas as linhas</SelectItem>
                      </SelectContent>
                    </Select>
                    {templateModelAction === 'replace' ? (
                      <BulkDeviceModelsPicker
                        instanceId="bulk-template-dm"
                        value={templateModelIds}
                        onChange={(next) => {
                          setTemplateModelIds(next)
                          queueMicrotask(() => syncAllRowsToTemplateIds(next))
                        }}
                        labels={modelLabels}
                        mergeLabelsFromRows={mergeLabelsFromRows}
                        disabled={submitting}
                      />
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
                        <th className="sticky top-0 z-10 min-w-[10rem] px-2 py-2 font-medium">Tag de precificação</th>
                        {allowDeviceModel ? (
                          <th className="sticky top-0 z-10 min-w-[9rem] px-2 py-2 font-medium">Modelos</th>
                        ) : null}
                        <th className="sticky top-0 z-10 min-w-[7rem] px-2 py-2 font-medium">Venda</th>
                        <th className="sticky top-0 z-10 w-24 px-2 py-2 font-medium">Sugerido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((it) => {
                        const row = rowStates[it.id]
                        if (!row) return null
                        const sugg = suggestionForItem(it, row)
                        const iniModels = initialRowStates[it.id]?.modelIds ?? []

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
                              <td className="px-1 py-1.5 align-middle">
                                <div className="flex max-w-[11rem] flex-col gap-0.5">
                                  <BulkDeviceModelsPicker
                                    instanceId={`bulk-row-${it.id}`}
                                    value={row.modelIds}
                                    onChange={(next) => updateRow(it.id, { modelIds: next })}
                                    labels={modelLabels}
                                    mergeLabelsFromRows={mergeLabelsFromRows}
                                    disabled={submitting}
                                    baselineIds={iniModels}
                                  />
                                  {sameModelIdSet(row.modelIds, iniModels) ? (
                                    <span className="text-[10px] text-muted-foreground">Igual ao cadastro</span>
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
