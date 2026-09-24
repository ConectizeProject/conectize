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
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { maskFci } from '@/lib/fiscal/fci'
import { maskCest, maskNcm } from '@/lib/fiscal/ncm'
import { suggestedSaleCents } from '@/lib/pricing/suggested-sale-cents'
import {
  BULK_EDIT_GROUP_LABELS,
  hasBulkEditField,
  type BulkEditFieldKey,
  type BulkEditGroup,
} from '@/lib/products/bulk-edit-fields'
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
    catalogCostPriceCents: number | null
    pricingTagId: string | null
    deviceModelIds: string[]
    ncm: string | null
    cest: string | null
    fiscalOrigin: number | null
    fci: string | null
    fiscalUnit: string | null
    description: string | null
    isActive: boolean
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
  modelIds: string[]
  saleMasked: string
  costMasked: string
  ncm: string
  cest: string
  fiscalOrigin: string
  fci: string
  fiscalUnit: string
  description: string
  isActive: boolean
}

const FISCAL_ORIGIN_OPTIONS = [
  { value: '0', label: '0 - Nacional' },
  { value: '1', label: '1 - Estrangeira (imp. direta)' },
  { value: '2', label: '2 - Estrangeira (mercado interno)' },
  { value: '3', label: '3 - Nacional CI 40–70%' },
  { value: '4', label: '4 - Nacional PPB' },
  { value: '5', label: '5 - Nacional CI ≤40%' },
  { value: '6', label: '6 - Estrangeira (imp. direta, CAMEX)' },
  { value: '7', label: '7 - Estrangeira (mercado interno, CAMEX)' },
  { value: '8', label: '8 - Nacional CI >70%' },
]

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

function normalizeFiscalOrigin (value: unknown) {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '0'
  return String(Math.min(8, Math.max(0, Math.round(n))))
}

type BulkDeviceModelsPickerProps = {
  value: string[]
  onChange: (ids: string[]) => void
  labels: Record<string, string>
  mergeLabelsFromRows: (rows: DeviceCatalogRow[]) => void
  disabled?: boolean
  baselineIds?: string[]
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

function rowChangedForFields (
  cur: RowValues,
  ini: RowValues,
  fields: readonly BulkEditFieldKey[],
  allowDeviceModel: boolean,
): boolean {
  if (hasBulkEditField(fields, 'pricingTagId') && cur.tag !== ini.tag) return true
  if (
    hasBulkEditField(fields, 'compatibleModelIds')
    && allowDeviceModel
    && !sameModelIdSet(cur.modelIds, ini.modelIds)
  ) {
    return true
  }
  if (hasBulkEditField(fields, 'salePrice') && cur.saleMasked !== ini.saleMasked) return true
  if (hasBulkEditField(fields, 'costPrice') && cur.costMasked !== ini.costMasked) return true
  if (hasBulkEditField(fields, 'ncm') && cur.ncm !== ini.ncm) return true
  if (hasBulkEditField(fields, 'cest') && cur.cest !== ini.cest) return true
  if (hasBulkEditField(fields, 'fiscalOrigin') && cur.fiscalOrigin !== ini.fiscalOrigin) return true
  if (hasBulkEditField(fields, 'fci') && cur.fci !== ini.fci) return true
  if (hasBulkEditField(fields, 'fiscalUnit') && cur.fiscalUnit !== ini.fiscalUnit) return true
  if (hasBulkEditField(fields, 'description') && cur.description !== ini.description) return true
  if (hasBulkEditField(fields, 'isActive') && cur.isActive !== ini.isActive) return true
  return false
}

function bulkPatchErrorLabel (error: string, message?: string) {
  if (message && String(message).trim()) return String(message).trim()
  switch (error) {
    case 'cest_required':
      return 'Informe o CEST exigido para o NCM.'
    case 'cest_mismatch':
      return 'CEST incompatível com o NCM.'
    case 'cest_not_required':
      return 'Este NCM não deve ter CEST.'
    case 'invalid_ncm':
      return 'NCM inválido (8 dígitos).'
    case 'invalid_cest':
      return 'CEST inválido (7 dígitos).'
    case 'invalid_fci':
      return 'FCI inválido (formato UUID).'
    case 'fiscalOrigin_invalid':
      return 'Origem fiscal inválida.'
    case 'nothing_to_update':
      return 'Nada para atualizar nesta linha.'
    case 'not_found':
      return 'Produto não encontrado.'
    default:
      return error || 'Falha ao salvar'
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productIds: string[]
  group: BulkEditGroup
  fields: BulkEditFieldKey[]
  allowDeviceModel: boolean
  onSuccess: () => void
}

export function BulkEditProductsModal ({
  open,
  onOpenChange,
  productIds,
  group,
  fields,
  allowDeviceModel,
  onSuccess,
}: Props) {
  const showCost = hasBulkEditField(fields, 'costPrice')
  const showSale = hasBulkEditField(fields, 'salePrice')
  const showTag = hasBulkEditField(fields, 'pricingTagId')
  const showModels = hasBulkEditField(fields, 'compatibleModelIds') && allowDeviceModel
  const showNcm = hasBulkEditField(fields, 'ncm')
  const showCest = hasBulkEditField(fields, 'cest')
  const showOrigin = hasBulkEditField(fields, 'fiscalOrigin')
  const showFci = hasBulkEditField(fields, 'fci')
  const showUnit = hasBulkEditField(fields, 'fiscalUnit')
  const showDescription = hasBulkEditField(fields, 'description')
  const showActive = hasBulkEditField(fields, 'isActive')
  const showSuggested = showSale && (showTag || showCost)

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
  const [templateCostMasked, setTemplateCostMasked] = useState('')
  const [templatePriceMode, setTemplatePriceMode] = useState<'fixed' | 'suggested'>('fixed')
  const [templateNcm, setTemplateNcm] = useState('')
  const [templateCest, setTemplateCest] = useState('')
  const [templateOrigin, setTemplateOrigin] = useState('__keep__')
  const [templateFci, setTemplateFci] = useState('')
  const [templateUnit, setTemplateUnit] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateActive, setTemplateActive] = useState<'__keep__' | 'true' | 'false'>('__keep__')
  const [submitting, setSubmitting] = useState(false)

  const resetTemplates = useCallback(() => {
    setTemplateTag('__keep__')
    setTemplateModelAction('keep')
    setTemplateModelIds([])
    setTemplateSaleMasked('')
    setTemplateCostMasked('')
    setTemplatePriceMode('fixed')
    setTemplateNcm('')
    setTemplateCest('')
    setTemplateOrigin('__keep__')
    setTemplateFci('')
    setTemplateUnit('')
    setTemplateDescription('')
    setTemplateActive('__keep__')
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

      const needTags = showTag || showSale
      const [tagsRes, metaRes] = await Promise.all([
        needTags
          ? fetch('/api/portal/staff/pricing-tags')
          : Promise.resolve(
            new Response(JSON.stringify({ ok: true, pricingTags: [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          ),
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
          costMasked:
            typeof it.catalogCostPriceCents === 'number'
              ? maskedFromCents(it.catalogCostPriceCents)
              : '',
          ncm: maskNcm(it.ncm || ''),
          cest: maskCest(it.cest || ''),
          fiscalOrigin: normalizeFiscalOrigin(it.fiscalOrigin),
          fci: maskFci(it.fci || ''),
          fiscalUnit: String(it.fiscalUnit || 'UN'),
          description: String(it.description || ''),
          isActive: it.isActive !== false,
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
      if (showModels && idArr.length > 0 && !cancelled) {
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
  }, [open, productIds, resetTemplates, showModels, showTag, showSale])

  const hasChanges = useMemo(() => {
    for (const id of Object.keys(rowStates)) {
      const a = rowStates[id]
      const b = initialRowStates[id]
      if (!a || !b) continue
      if (rowChangedForFields(a, b, fields, allowDeviceModel)) return true
    }
    return false
  }, [rowStates, initialRowStates, fields, allowDeviceModel])

  const suggestionForItem = useCallback(
    (it: Extract<BulkMetaItem, { missing: false }>, row: RowValues): number | null => {
      let tagId: string | null = null
      if (row.tag !== '__keep__' && row.tag !== '__clear__') tagId = row.tag
      else if (row.tag === '__keep__') tagId = it.pricingTagId
      if (!tagId) return null
      const tag = pricingTags.find((t) => t.id === tagId)
      if (!tag) return null
      const margin = tag.margin_bps != null ? Number(tag.margin_bps) : 0
      let costCents = it.costPriceCents
      if (showCost) {
        const parsed = parseMaskedMoneyToCents(row.costMasked)
        if (parsed !== 'invalid' && parsed != null) costCents = parsed
      }
      return suggestedSaleCents({
        costCents,
        marginBps: margin,
        minSuggestedSaleCents: tag.min_suggested_sale_cents,
      })
    },
    [pricingTags, showCost],
  )

  function updateRow (id: string, patch: Partial<RowValues>) {
    setRowStates((prev) => {
      const cur = prev[id]
      if (!cur) return prev
      const merged = { ...cur, ...patch }
      if (
        templatePriceMode === 'suggested'
        && showSale
        && (
          Object.prototype.hasOwnProperty.call(patch, 'tag')
          || Object.prototype.hasOwnProperty.call(patch, 'costMasked')
        )
      ) {
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

  function applyCostToAllRows (masked: string) {
    setRowStates((prev) => {
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        next[id] = { ...next[id], costMasked: masked }
      }
      return next
    })
  }

  function applyFieldToAllRows (patch: Partial<RowValues>) {
    setRowStates((prev) => {
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        next[id] = { ...next[id], ...patch }
      }
      return next
    })
  }

  /** Aplica o template às linhas de forma síncrona (evita perder blur ao clicar em Salvar). */
  function buildEffectiveRowStates (): Record<string, RowValues> {
    const patch: Partial<RowValues> = {}

    if (showTag && templateTag !== '__keep__') {
      patch.tag = templateTag
    }
    if (showModels) {
      if (templateModelAction === 'clear') patch.modelIds = []
      else if (templateModelAction === 'replace') patch.modelIds = uniqModelIds(templateModelIds)
    }
    if (showCost && templateCostMasked.trim()) {
      patch.costMasked = templateCostMasked
    }
    if (showSale && templatePriceMode === 'fixed' && templateSaleMasked.trim()) {
      patch.saleMasked = templateSaleMasked
    }
    if (showNcm && templateNcm.trim()) {
      patch.ncm = templateNcm
    }
    if (showCest && templateCest.trim()) {
      patch.cest = templateCest
    }
    if (showOrigin && templateOrigin !== '__keep__') {
      patch.fiscalOrigin = templateOrigin
    }
    if (showFci && templateFci.trim()) {
      patch.fci = templateFci
    }
    if (showUnit && templateUnit.trim()) {
      patch.fiscalUnit = templateUnit.trim().toUpperCase()
    }
    if (showDescription && templateDescription.trim()) {
      patch.description = templateDescription
    }
    if (showActive && templateActive !== '__keep__') {
      patch.isActive = templateActive === 'true'
    }

    if (Object.keys(patch).length === 0) return rowStates

    const next: Record<string, RowValues> = {}
    for (const id of Object.keys(rowStates)) {
      next[id] = { ...rowStates[id], ...patch }
    }
    return next
  }

  const hasPendingTemplate = useMemo(() => {
    if (showTag && templateTag !== '__keep__') return true
    if (showModels && templateModelAction !== 'keep') return true
    if (showCost && templateCostMasked.trim()) return true
    if (showSale && templatePriceMode === 'fixed' && templateSaleMasked.trim()) return true
    if (showNcm && templateNcm.trim()) return true
    if (showCest && templateCest.trim()) return true
    if (showOrigin && templateOrigin !== '__keep__') return true
    if (showFci && templateFci.trim()) return true
    if (showUnit && templateUnit.trim()) return true
    if (showDescription && templateDescription.trim()) return true
    if (showActive && templateActive !== '__keep__') return true
    return false
  }, [
    showTag,
    templateTag,
    showModels,
    templateModelAction,
    showCost,
    templateCostMasked,
    showSale,
    templatePriceMode,
    templateSaleMasked,
    showNcm,
    templateNcm,
    showCest,
    templateCest,
    showOrigin,
    templateOrigin,
    showFci,
    templateFci,
    showUnit,
    templateUnit,
    showDescription,
    templateDescription,
    showActive,
    templateActive,
  ])

  const canSubmit = hasChanges || hasPendingTemplate

  useEffect(() => {
    if (!open || loadingMeta || templatePriceMode !== 'suggested' || !showSale) return
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
    showSale,
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
    const effectiveRows = buildEffectiveRowStates()
    if (effectiveRows !== rowStates) {
      setRowStates(effectiveRows)
    }

    let anyChanged = false
    for (const id of Object.keys(effectiveRows)) {
      const a = effectiveRows[id]
      const b = initialRowStates[id]
      if (!a || !b) continue
      if (rowChangedForFields(a, b, fields, allowDeviceModel)) {
        anyChanged = true
        break
      }
    }
    if (!anyChanged) {
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
      const cur = effectiveRows[it.id]
      if (!cur) continue
      if (showSale) {
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
      if (showCost) {
        const costParsed = parseMaskedMoneyToCents(cur.costMasked)
        if (costParsed === 'invalid') {
          toast({
            variant: 'destructive',
            title: 'Custo inválido',
            description: `Verifique o valor de custo em «${it.name}».`,
          })
          return
        }
      }
    }

    const patchItems: Array<Record<string, unknown>> = []

    for (const it of okItems) {
      const cur = effectiveRows[it.id]
      const ini = initialRowStates[it.id]
      if (!cur || !ini) continue
      if (!rowChangedForFields(cur, ini, fields, allowDeviceModel)) continue

      const body: Record<string, unknown> = { productId: it.id }

      if (showTag && cur.tag !== ini.tag) {
        if (cur.tag === '__clear__') body.pricingTagId = null
        else if (cur.tag !== '__keep__') body.pricingTagId = cur.tag
      }

      if (showModels && !sameModelIdSet(cur.modelIds, ini.modelIds)) {
        body.compatibleModelIds = cur.modelIds
      }

      if (showSale && cur.saleMasked !== ini.saleMasked) {
        const curCents = parseMaskedMoneyToCents(cur.saleMasked)
        if (curCents !== 'invalid') {
          body.salePrice = (curCents === null ? 0 : curCents) / 100
        }
      }

      if (showCost && cur.costMasked !== ini.costMasked) {
        const curCents = parseMaskedMoneyToCents(cur.costMasked)
        if (curCents !== 'invalid') {
          body.costPrice = (curCents === null ? 0 : curCents) / 100
        }
      }

      if (showNcm && cur.ncm !== ini.ncm) {
        body.ncm = cur.ncm.trim() || null
      }
      if (showCest && cur.cest !== ini.cest) {
        body.cest = cur.cest.trim() || null
      }
      if (showOrigin && cur.fiscalOrigin !== ini.fiscalOrigin) {
        body.fiscalOrigin = Number(cur.fiscalOrigin)
      }
      if (showFci && cur.fci !== ini.fci) {
        body.fci = cur.fci.trim() || null
      }
      if (showUnit && cur.fiscalUnit !== ini.fiscalUnit) {
        body.fiscalUnit = cur.fiscalUnit.trim() || null
      }
      if (showDescription && cur.description !== ini.description) {
        body.description = cur.description
      }
      if (showActive && cur.isActive !== ini.isActive) {
        body.isActive = cur.isActive
      }

      if (Object.keys(body).length <= 1) continue
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

      const failResults = Array.isArray(data?.results)
        ? (data.results as Array<{ ok?: boolean; error?: string; message?: string; productId?: string }>)
          .filter((r) => r && r.ok === false)
        : []
      const nameById = new Map(okItems.map((it) => [it.id, it.name]))
      const failHints = failResults.slice(0, 3).map((r) => {
        const name = nameById.get(String(r.productId || '')) || 'Produto'
        return `${name}: ${bulkPatchErrorLabel(String(r.error || ''), r.message)}`
      })
      const failExtra = failResults.length > 3
        ? ` (+${failResults.length - 3} outra${failResults.length - 3 === 1 ? '' : 's'})`
        : ''

      toast({
        variant: fail > 0 ? (ok > 0 ? 'default' : 'destructive') : 'success',
        title: 'Edição em massa',
        description: fail > 0
          ? `${ok} atualizado${ok === 1 ? '' : 's'}, ${fail} falha${fail === 1 ? '' : 's'}.${failHints.length > 0 ? ` ${failHints.join(' · ')}${failExtra}` : ''}`
          : `${ok} atualizado${ok === 1 ? '' : 's'}.`,
      })

      if (ok > 0 && fail === 0) {
        onSuccess()
        onOpenChange(false)
      } else if (ok > 0) {
        onSuccess()
        setInitialRowStates((prev) => {
          const next = { ...prev }
          for (const r of Array.isArray(data?.results) ? data.results : []) {
            if (!r || r.ok !== true) continue
            const id = String(r.productId || '')
            if (id && effectiveRows[id]) next[id] = { ...effectiveRows[id] }
          }
          return next
        })
        setRowStates((prev) => {
          const next = { ...prev }
          for (const id of Object.keys(effectiveRows)) {
            next[id] = { ...effectiveRows[id] }
          }
          return next
        })
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

  const templateCols = [
    showTag,
    showModels,
    showCost,
    showSale,
    showNcm,
    showCest,
    showOrigin,
    showFci,
    showUnit,
    showDescription,
    showActive,
  ].filter(Boolean).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,900px)] w-[min(96vw,1180px)] max-w-[min(96vw,1180px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1180px)]">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4">
          <DialogTitle>
            Editar em massa —
            {' '}
            {BULK_EDIT_GROUP_LABELS[group]}
          </DialogTitle>
          <DialogDescription>
            {productIds.length} selecionado
            {productIds.length === 1 ? '' : 's'}
            {nMissing > 0 ? ` (${nMissing} não encontrado${nMissing === 1 ? '' : 's'} na base)` : ''}
            . Use o modelo acima para replicar valores; edite linha a linha na tabela.
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
              {templateCols > 0 ? (
                <div
                  className={cn(
                    'grid shrink-0 grid-cols-1 gap-4 border-b border-border/60 pb-4 lg:gap-6',
                    templateCols >= 3 ? 'lg:grid-cols-3' : templateCols === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-1',
                  )}
                >
                  {showTag ? (
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
                  ) : null}

                  {showModels ? (
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

                  {showCost ? (
                    <div className="space-y-2">
                      <Label htmlFor="bulk-template-cost">Preço de custo</Label>
                      <Input
                        id="bulk-template-cost"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="0,00"
                        value={templateCostMasked}
                        onChange={(e) => setTemplateCostMasked(formatMoneyInput(e.target.value))}
                        onBlur={() => applyCostToAllRows(templateCostMasked)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                        }}
                        className="h-9 tabular-nums"
                        disabled={submitting}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Replica ao sair do campo ou Enter.
                      </p>
                    </div>
                  ) : null}

                  {showSale ? (
                    <div className="space-y-3">
                      <Label>Preço de venda</Label>
                      {showSuggested ? (
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
                      ) : null}
                      {templatePriceMode === 'fixed' || !showSuggested ? (
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
                              if (e.key === 'Enter') e.currentTarget.blur()
                            }}
                            className="h-9 tabular-nums"
                            disabled={submitting}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Replica ao sair do campo ou Enter.
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          Preenche a coluna Venda com o sugerido de cada item (margem da tag × custo).
                        </p>
                      )}
                    </div>
                  ) : null}

                  {showNcm ? (
                    <div className="space-y-2">
                      <Label htmlFor="bulk-template-ncm">NCM</Label>
                      <Input
                        id="bulk-template-ncm"
                        value={templateNcm}
                        onChange={(e) => setTemplateNcm(maskNcm(e.target.value))}
                        onBlur={(e) => {
                          const next = maskNcm(e.target.value)
                          setTemplateNcm(next)
                          if (next.trim()) applyFieldToAllRows({ ncm: next })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                        }}
                        placeholder="0000.00.00"
                        className="h-9"
                        disabled={submitting}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Replica ao sair do campo ou Enter. Também aplica ao salvar.
                      </p>
                    </div>
                  ) : null}

                  {showCest ? (
                    <div className="space-y-2">
                      <Label htmlFor="bulk-template-cest">CEST</Label>
                      <Input
                        id="bulk-template-cest"
                        value={templateCest}
                        onChange={(e) => setTemplateCest(maskCest(e.target.value))}
                        onBlur={(e) => {
                          const next = maskCest(e.target.value)
                          setTemplateCest(next)
                          if (next.trim()) applyFieldToAllRows({ cest: next })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                        }}
                        placeholder="00.000.00"
                        className="h-9"
                        disabled={submitting}
                      />
                    </div>
                  ) : null}

                  {showOrigin ? (
                    <div className="space-y-2">
                      <Label htmlFor="bulk-template-origin">Origem</Label>
                      <Select
                        value={templateOrigin}
                        onValueChange={(v) => {
                          setTemplateOrigin(v)
                          if (v === '__keep__') return
                          applyFieldToAllRows({ fiscalOrigin: v })
                        }}
                        disabled={submitting}
                      >
                        <SelectTrigger id="bulk-template-origin" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__keep__">Manter atual (cada linha)</SelectItem>
                          {FISCAL_ORIGIN_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {showFci ? (
                    <div className="space-y-2">
                      <Label htmlFor="bulk-template-fci">FCI</Label>
                      <Input
                        id="bulk-template-fci"
                        value={templateFci}
                        onChange={(e) => setTemplateFci(maskFci(e.target.value))}
                        onBlur={(e) => {
                          const next = maskFci(e.target.value)
                          setTemplateFci(next)
                          if (next.trim()) applyFieldToAllRows({ fci: next })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                        }}
                        className="h-9 font-mono text-xs"
                        disabled={submitting}
                      />
                    </div>
                  ) : null}

                  {showUnit ? (
                    <div className="space-y-2">
                      <Label htmlFor="bulk-template-unit">Unidade</Label>
                      <Input
                        id="bulk-template-unit"
                        value={templateUnit}
                        maxLength={6}
                        onChange={(e) => setTemplateUnit(e.target.value.toUpperCase())}
                        onBlur={(e) => {
                          const next = e.target.value.trim().toUpperCase() || 'UN'
                          setTemplateUnit(next)
                          applyFieldToAllRows({ fiscalUnit: next })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                        }}
                        placeholder="UN"
                        className="h-9"
                        disabled={submitting}
                      />
                    </div>
                  ) : null}

                  {showDescription ? (
                    <div className="space-y-2 lg:col-span-2">
                      <Label htmlFor="bulk-template-description">Descrição</Label>
                      <Textarea
                        id="bulk-template-description"
                        value={templateDescription}
                        onChange={(e) => setTemplateDescription(e.target.value)}
                        onBlur={() => applyFieldToAllRows({ description: templateDescription })}
                        rows={2}
                        disabled={submitting}
                      />
                    </div>
                  ) : null}

                  {showActive ? (
                    <div className="space-y-2">
                      <Label htmlFor="bulk-template-active">Ativo</Label>
                      <Select
                        value={templateActive}
                        onValueChange={(v) => {
                          const next = v as '__keep__' | 'true' | 'false'
                          setTemplateActive(next)
                          if (next === '__keep__') return
                          applyFieldToAllRows({ isActive: next === 'true' })
                        }}
                        disabled={submitting}
                      >
                        <SelectTrigger id="bulk-template-active" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__keep__">Manter atual (cada linha)</SelectItem>
                          <SelectItem value="true">Ativo</SelectItem>
                          <SelectItem value="false">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-hidden">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Itens — edite cada coluna</p>
                <ScrollArea className="h-[min(48vh,420px)] rounded-md border">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                        <th className="sticky top-0 z-10 min-w-[9rem] px-2 py-2 font-medium">Produto</th>
                        {showTag ? (
                          <th className="sticky top-0 z-10 min-w-[10rem] px-2 py-2 font-medium">Tag</th>
                        ) : null}
                        {showModels ? (
                          <th className="sticky top-0 z-10 min-w-[9rem] px-2 py-2 font-medium">Modelos</th>
                        ) : null}
                        {showCost ? (
                          <th className="sticky top-0 z-10 min-w-[7rem] px-2 py-2 font-medium">Custo</th>
                        ) : null}
                        {showSale ? (
                          <th className="sticky top-0 z-10 min-w-[7rem] px-2 py-2 font-medium">Venda</th>
                        ) : null}
                        {showSuggested ? (
                          <th className="sticky top-0 z-10 w-24 px-2 py-2 font-medium">Sugerido</th>
                        ) : null}
                        {showNcm ? (
                          <th className="sticky top-0 z-10 min-w-[7rem] px-2 py-2 font-medium">NCM</th>
                        ) : null}
                        {showCest ? (
                          <th className="sticky top-0 z-10 min-w-[6rem] px-2 py-2 font-medium">CEST</th>
                        ) : null}
                        {showOrigin ? (
                          <th className="sticky top-0 z-10 min-w-[8rem] px-2 py-2 font-medium">Origem</th>
                        ) : null}
                        {showFci ? (
                          <th className="sticky top-0 z-10 min-w-[10rem] px-2 py-2 font-medium">FCI</th>
                        ) : null}
                        {showUnit ? (
                          <th className="sticky top-0 z-10 min-w-[4rem] px-2 py-2 font-medium">Un.</th>
                        ) : null}
                        {showDescription ? (
                          <th className="sticky top-0 z-10 min-w-[12rem] px-2 py-2 font-medium">Descrição</th>
                        ) : null}
                        {showActive ? (
                          <th className="sticky top-0 z-10 min-w-[5rem] px-2 py-2 font-medium">Ativo</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((it) => {
                        const row = rowStates[it.id]
                        if (!row) return null
                        const sugg = showSuggested ? suggestionForItem(it, row) : null
                        const iniModels = initialRowStates[it.id]?.modelIds ?? []

                        return (
                          <tr key={it.id} className="border-b border-border/60 align-top hover:bg-muted/20">
                            <td className="max-w-[14rem] px-2 py-2">
                              <span className="line-clamp-2 font-medium leading-tight" title={it.name}>
                                {it.name}
                              </span>
                            </td>
                            {showTag ? (
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
                            ) : null}
                            {showModels ? (
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
                            {showCost ? (
                              <td className="px-1 py-1.5">
                                <Input
                                  inputMode="numeric"
                                  autoComplete="off"
                                  placeholder="0,00"
                                  value={row.costMasked}
                                  onChange={(e) =>
                                    updateRow(it.id, { costMasked: formatMoneyInput(e.target.value) })}
                                  className="h-9 w-[7.5rem] tabular-nums text-xs"
                                  disabled={submitting}
                                />
                              </td>
                            ) : null}
                            {showSale ? (
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
                            ) : null}
                            {showSuggested ? (
                              <td className="px-2 py-2 text-xs tabular-nums text-muted-foreground">
                                {formatBrl(sugg)}
                              </td>
                            ) : null}
                            {showNcm ? (
                              <td className="px-1 py-1.5">
                                <Input
                                  value={row.ncm}
                                  onChange={(e) => updateRow(it.id, { ncm: maskNcm(e.target.value) })}
                                  className="h-9 w-[8rem] text-xs"
                                  disabled={submitting}
                                />
                              </td>
                            ) : null}
                            {showCest ? (
                              <td className="px-1 py-1.5">
                                <Input
                                  value={row.cest}
                                  onChange={(e) => updateRow(it.id, { cest: maskCest(e.target.value) })}
                                  className="h-9 w-[7rem] text-xs"
                                  disabled={submitting}
                                />
                              </td>
                            ) : null}
                            {showOrigin ? (
                              <td className="px-1 py-1.5">
                                <Select
                                  value={row.fiscalOrigin}
                                  onValueChange={(v) => updateRow(it.id, { fiscalOrigin: v })}
                                  disabled={submitting}
                                >
                                  <SelectTrigger className="h-9 max-w-[10rem] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FISCAL_ORIGIN_OPTIONS.map((o) => (
                                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                            ) : null}
                            {showFci ? (
                              <td className="px-1 py-1.5">
                                <Input
                                  value={row.fci}
                                  onChange={(e) => updateRow(it.id, { fci: maskFci(e.target.value) })}
                                  className="h-9 w-[12rem] font-mono text-[10px]"
                                  disabled={submitting}
                                />
                              </td>
                            ) : null}
                            {showUnit ? (
                              <td className="px-1 py-1.5">
                                <Input
                                  value={row.fiscalUnit}
                                  maxLength={6}
                                  onChange={(e) =>
                                    updateRow(it.id, { fiscalUnit: e.target.value.toUpperCase() })}
                                  className="h-9 w-[4rem] text-xs"
                                  disabled={submitting}
                                />
                              </td>
                            ) : null}
                            {showDescription ? (
                              <td className="px-1 py-1.5">
                                <Textarea
                                  value={row.description}
                                  onChange={(e) => updateRow(it.id, { description: e.target.value })}
                                  rows={2}
                                  className="min-w-[12rem] text-xs"
                                  disabled={submitting}
                                />
                              </td>
                            ) : null}
                            {showActive ? (
                              <td className="px-1 py-1.5">
                                <div className="flex h-9 items-center px-1">
                                  <Checkbox
                                    checked={row.isActive}
                                    onCheckedChange={(checked) =>
                                      updateRow(it.id, { isActive: checked === true })}
                                    disabled={submitting}
                                    aria-label={`Ativo — ${it.name}`}
                                  />
                                </div>
                              </td>
                            ) : null}
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
            disabled={submitting || loadingMeta || nOk === 0 || !canSubmit}
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
