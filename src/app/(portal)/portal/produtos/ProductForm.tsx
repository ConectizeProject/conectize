'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Barcode, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { suggestedSaleCents } from '@/lib/pricing/suggested-sale-cents'
import { cn } from '@/lib/utils'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import { toast } from '@/hooks/use-toast'

export type ProductFormProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  description: string | null
  imageUrl?: string | null
  salePriceCents: number | null
  costPriceCents: number | null
  pricingTagId: string | null
  isActive: boolean
  kind?: 'product' | 'service' | null
}

export type ProductFormSubmitPayload = {
  name: string
  sku: string | null
  barcode: string | null
  description: string | null
  imageUrl: string | null
  kind: 'product' | 'service'
  salePrice: number
  costPrice: number
  isActive: boolean
  pricingTagId: string | null
  compatibleModelIds: string[]
  initialStock: number
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

/** Remove acentos para comparar busca com rótulo (ex.: "ação" → "acao"). */
function normalizeSearchFold (raw: string) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const COMPAT_SEARCH_STOPWORDS = new Set([
  'a', 'e', 'o', 'os', 'as', 'da', 'de', 'do', 'das', 'dos', 'di', 'em', 'no', 'na', 'nos', 'nas',
  'ao', 'aos', 'por', 'para', 'com', 'sem',
])

/** Palavras com 2+ caracteres, ignorando conectivos comuns ("M12 da Samsung" → m12, samsung). */
function compatibleSearchTokens (raw: string) {
  const n = normalizeSearchFold(raw)
  const parts = n.split(/[\s,;/|]+/).map((t) => t.trim()).filter(Boolean)
  return parts.filter((p) => p.length >= 2 && !COMPAT_SEARCH_STOPWORDS.has(p))
}

function labelMatchesCompatibleQuery (label: string, rawQuery: string) {
  const raw = String(rawQuery || '').trim()
  if (raw.length < 2) return false
  const hay = normalizeSearchFold(label)
  const tokens = compatibleSearchTokens(raw)
  if (tokens.length === 0) {
    return hay.includes(normalizeSearchFold(raw))
  }
  return tokens.every((t) => hay.includes(t))
}

function deviceRowToOption (d: DeviceCatalogRow) {
  return {
    value: d.id,
    label: [d.brand, d.device_type, d.model].filter(Boolean).join(' ') || d.id,
  }
}

export type CompatibleEntry = { id: string; label: string }

function formatBrl (cents: number | null) {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Centavos a partir do texto mascarado (pt-BR); vazio → null; inválido → 'invalid'. */
function parseMaskedMoneyToCents (raw: string): number | null | 'invalid' {
  const t = raw.trim()
  if (!t) return null
  const c = moneyToCentsFromMasked(t)
  if (c === null) return null
  if (c < 0) return 'invalid'
  return c
}

function calculateEAN13Checksum (code12: string) {
  let sum = 0
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(code12[i])
    sum += i % 2 === 0 ? digit : digit * 3
  }
  return (10 - (sum % 10)) % 10
}

function generateEAN13 () {
  const prefix = '761'
  const randomNineDigits = Math.floor(100000000 + Math.random() * 900000000)
  const baseCode = `${prefix}${randomNineDigits.toString()}`
  const checksum = calculateEAN13Checksum(baseCode)
  return `${baseCode}${checksum}`
}

type Props = {
  mode: 'create' | 'edit'
  product?: ProductFormProduct
  initialCompatibleModels?: CompatibleEntry[]
  defaultKind?: 'product' | 'service'
  embed?: boolean
  /** Quantidade de variações ativas (produto pai); se maior que zero, exibe ação para replicar a URL da foto. */
  variationChildCount?: number
  applyImageToChildrenBusy?: boolean
  onApplyImageToVariationChildren?: (imageUrl: string | null) => Promise<void>
  onSubmit: (payload: ProductFormSubmitPayload) => Promise<void>
  onCancel: () => void
}

export function ProductForm ({
  mode,
  product,
  initialCompatibleModels,
  defaultKind = 'product',
  embed = false,
  variationChildCount = 0,
  applyImageToChildrenBusy = false,
  onApplyImageToVariationChildren,
  onSubmit,
  onCancel,
}: Props) {
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [submitErrors, setSubmitErrors] = useState<{
    name?: string
    salePrice?: string
    costPrice?: string
  }>({})
  const [pending, setPending] = useState(false)
  const [pricingTags, setPricingTags] = useState<PricingTagRow[]>([])
  const [pricingTagId, setPricingTagId] = useState(() => product?.pricingTagId || '')
  const [kind, setKind] = useState<'product' | 'service'>(() => {
    if (product?.kind === 'service') return 'service'
    if (product?.kind === 'product') return 'product'
    return defaultKind
  })
  const [description, setDescription] = useState(() => product?.description || '')
  const [imageUrl, setImageUrl] = useState(() =>
    product?.imageUrl != null && String(product.imageUrl).trim()
      ? String(product.imageUrl).trim()
      : '',
  )
  const [isActive, setIsActive] = useState(() => product?.isActive !== false)
  const [saleReais, setSaleReais] = useState(() =>
    typeof product?.salePriceCents === 'number'
      ? maskedFromCents(product.salePriceCents)
      : '',
  )
  const [costReais, setCostReais] = useState(() =>
    typeof product?.costPriceCents === 'number'
      ? maskedFromCents(product.costPriceCents)
      : '',
  )

  const [compatibleModels, setCompatibleModels] = useState<CompatibleEntry[]>(() =>
    Array.isArray(initialCompatibleModels) ? [...initialCompatibleModels] : [],
  )

  const [deviceCatalog, setDeviceCatalog] = useState<DeviceCatalogRow[]>([])
  const [deviceCatalogLoading, setDeviceCatalogLoading] = useState(true)
  const [deviceModelQuery, setDeviceModelQuery] = useState('')
  const [compatibleSuggestions, setCompatibleSuggestions] = useState<{ value: string; label: string }[]>([])
  const deviceCompatBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [tagSuggestOpen, setTagSuggestOpen] = useState(false)
  const [tagSuggestDraft, setTagSuggestDraft] = useState('')

  useEffect(() => {
    setCompatibleModels(Array.isArray(initialCompatibleModels) ? [...initialCompatibleModels] : [])
  }, [initialCompatibleModels])

  useEffect(() => {
    if (!product?.id) return
    setImageUrl(
      product.imageUrl != null && String(product.imageUrl).trim()
        ? String(product.imageUrl).trim()
        : '',
    )
  }, [product?.id, product?.imageUrl])

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setDeviceCatalogLoading(true)
      const res = await fetch('/api/portal/device-models?limit=8000')
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
  }, [])

  const deviceOptions = useMemo(
    () =>
      deviceCatalog
        .map((d) => deviceRowToOption(d))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    [deviceCatalog],
  )

  useEffect(() => {
    const raw = deviceModelQuery.trim()
    if (raw.length < 2) {
      setCompatibleSuggestions([])
      return
    }
    const fromCatalog = deviceOptions
      .filter((o) => labelMatchesCompatibleQuery(o.label, raw))
      .slice(0, 50)
    if (fromCatalog.length > 0) {
      setCompatibleSuggestions(fromCatalog)
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        const tokens = compatibleSearchTokens(raw)
        const token = [...tokens].sort((a, b) => b.length - a.length)[0] || normalizeSearchFold(raw).slice(0, 48)
        if (token.length < 2) {
          if (!cancelled) setCompatibleSuggestions([])
          return
        }
        const res = await fetch(
          `/api/portal/device-models?q=${encodeURIComponent(token)}&limit=400`,
        )
        const json = await res.json().catch(() => null)
        if (cancelled || !res.ok || !json?.ok) {
          if (!cancelled) setCompatibleSuggestions([])
          return
        }
        const rows = (json.deviceModels || []) as DeviceCatalogRow[]
        const mapped = rows.map((d) => deviceRowToOption(d))
        const filtered = mapped
          .filter((o) => labelMatchesCompatibleQuery(o.label, raw))
          .slice(0, 50)
        if (!cancelled) {
          setCompatibleSuggestions(filtered.length > 0 ? filtered : mapped.slice(0, 50))
        }
      })()
    }, 280)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [deviceModelQuery, deviceOptions])

  const selectedTag = useMemo(
    () => pricingTags.find((t) => t.id === pricingTagId) || null,
    [pricingTags, pricingTagId],
  )

  const previewSuggestedCents = useMemo(() => {
    if (!selectedTag) return null
    const costParsed = parseMaskedMoneyToCents(costReais)
    if (costParsed === 'invalid') return null
    if (costParsed == null || costParsed <= 0) return null
    const margin = selectedTag.margin_bps != null ? Number(selectedTag.margin_bps) : 0
    const minC = selectedTag.min_suggested_sale_cents
    return suggestedSaleCents({
      costCents: costParsed,
      marginBps: margin,
      minSuggestedSaleCents: minC,
    })
  }, [costReais, selectedTag])

  const showSuggestedSaleHint = useMemo(() => {
    if (!selectedTag || previewSuggestedCents == null) return false
    const saleParsed = parseMaskedMoneyToCents(saleReais)
    if (saleParsed === 'invalid') return false
    if (saleParsed != null && saleParsed === previewSuggestedCents) return false
    return true
  }, [selectedTag, previewSuggestedCents, saleReais])

  function handlePricingTagChange (v: string) {
    const next = v === '__none__' ? '' : v
    setPricingTagId(next)
    if (!next) return
    const costParsed = parseMaskedMoneyToCents(costReais)
    if (costParsed === 'invalid' || costParsed == null || costParsed <= 0) return
    const tag = pricingTags.find((t) => t.id === next)
    if (!tag) return
    const margin = tag.margin_bps != null ? Number(tag.margin_bps) : 0
    const suggested = suggestedSaleCents({
      costCents: costParsed,
      marginBps: margin,
      minSuggestedSaleCents: tag.min_suggested_sale_cents,
    })
    if (suggested == null) return
    const saleParsed = parseMaskedMoneyToCents(saleReais)
    const saleCents = saleParsed === 'invalid' ? null : saleParsed
    if (saleCents != null && saleCents === suggested) return
    setTagSuggestDraft(maskedFromCents(suggested))
    setTagSuggestOpen(true)
  }

  function confirmTagSuggestedPrice () {
    const raw = String(tagSuggestDraft).trim()
    if (!raw) {
      setTagSuggestOpen(false)
      return
    }
    const c = parseMaskedMoneyToCents(raw)
    if (c === 'invalid' || c === null) {
      toast({
        variant: 'destructive',
        title: 'Valor inválido',
        description: 'Informe um valor em reais no formato 0,00.',
      })
      return
    }
    setSaleReais(maskedFromCents(c))
    setTagSuggestOpen(false)
  }

  function applySuggestedSalePrice () {
    if (previewSuggestedCents == null) return
    setSaleReais(maskedFromCents(previewSuggestedCents))
  }

  function handlePickCompatibleModel (opt: { value: string; label: string }) {
    setCompatibleModels((prev) => {
      if (prev.some((m) => m.id === opt.value)) return prev
      return [...prev, { id: opt.value, label: opt.label }]
    })
    setDeviceModelQuery('')
    setCompatibleSuggestions([])
  }

  function removeCompatibleModel (id: string) {
    setCompatibleModels((prev) => prev.filter((m) => m.id !== id))
  }

  async function handleSubmit (event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitErrors({})
    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('name') || '').trim()
    if (!name) {
      setSubmitErrors({ name: 'Informe um nome para o produto ou serviço.' })
      queueMicrotask(() => nameInputRef.current?.focus())
      return
    }

    const saleCentsParsed = parseMaskedMoneyToCents(saleReais)
    if (saleCentsParsed === 'invalid') {
      setSubmitErrors({ salePrice: 'Valor de preço de venda inválido. Use o formato 0,00.' })
      return
    }
    const salePrice = saleCentsParsed == null ? 0 : saleCentsParsed / 100

    const costCentsParsed = parseMaskedMoneyToCents(costReais)
    if (costCentsParsed === 'invalid') {
      setSubmitErrors({ costPrice: 'Valor de preço de custo inválido. Use o formato 0,00.' })
      return
    }
    const costPrice = costCentsParsed == null ? 0 : costCentsParsed / 100

    const initialStockRaw = mode === 'create'
      ? Number(String(formData.get('initialStock') || '0').replace(',', '.'))
      : 0
    const initialStock = mode === 'create' && kind === 'product' && Number.isFinite(initialStockRaw) && initialStockRaw > 0
      ? Math.floor(initialStockRaw)
      : 0

    const payload: ProductFormSubmitPayload = {
      name,
      sku: String(formData.get('sku') || '').trim() || null,
      barcode: String(formData.get('barcode') || '').trim() || null,
      description: description.trim() || null,
      imageUrl: imageUrl.trim() || null,
      kind,
      salePrice,
      costPrice,
      isActive,
      pricingTagId: pricingTagId || null,
      compatibleModelIds: compatibleModels.map((m) => m.id),
      initialStock,
    }

    setPending(true)
    try {
      await onSubmit(payload)
    } finally {
      setPending(false)
    }
  }

  const title = mode === 'create' ? 'Novo produto/serviço' : 'Editar produto/serviço'

  const formInner = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,7.25rem)_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="product-kind">Tipo</Label>
          <select
            id="product-kind"
            className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={kind}
            disabled={pending}
            onChange={(e) => setKind(e.target.value === 'service' ? 'service' : 'product')}
          >
            <option value="product">Produto</option>
            <option value="service">Serviço</option>
          </select>
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            name="sku"
            defaultValue={product?.sku || ''}
            disabled={pending}
            className="min-w-0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="costPrice">Preço de custo</Label>
          <Input
            id="costPrice"
            name="costPrice"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0,00"
            value={costReais}
            onChange={(e) => {
              setCostReais(formatMoneyInput(e.target.value))
              if (submitErrors.costPrice) setSubmitErrors((s) => ({ ...s, costPrice: undefined }))
            }}
            disabled={pending}
            className={cn('tabular-nums', submitErrors.costPrice && 'border-destructive')}
            aria-invalid={submitErrors.costPrice ? true : undefined}
            aria-describedby={submitErrors.costPrice ? 'costPrice-error' : undefined}
          />
          {submitErrors.costPrice
            ? (
              <p id="costPrice-error" className="text-sm text-destructive" role="alert">
                {submitErrors.costPrice}
              </p>
            )
            : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="salePrice">Preço de venda</Label>
          <Input
            id="salePrice"
            name="salePrice"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0,00"
            value={saleReais}
            onChange={(e) => {
              setSaleReais(formatMoneyInput(e.target.value))
              if (submitErrors.salePrice) setSubmitErrors((s) => ({ ...s, salePrice: undefined }))
            }}
            disabled={pending}
            className={cn('tabular-nums', submitErrors.salePrice && 'border-destructive')}
            aria-invalid={submitErrors.salePrice ? true : undefined}
            aria-describedby={submitErrors.salePrice ? 'salePrice-error' : undefined}
          />
          {submitErrors.salePrice
            ? (
              <p id="salePrice-error" className="text-sm text-destructive" role="alert">
                {submitErrors.salePrice}
              </p>
            )
            : null}
          {showSuggestedSaleHint ? (
            <p className="flex flex-wrap items-center gap-0.5 text-[11px] leading-tight text-muted-foreground">
              <span>
                Sugerido{' '}
                <span className="tabular-nums font-medium text-foreground">{formatBrl(previewSuggestedCents)}</span>
              </span>
              <button
                type="button"
                className="inline-flex shrink-0 rounded p-px text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                onClick={applySuggestedSalePrice}
                aria-label="Aplicar preço sugerido"
              >
                <Check className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
              </button>
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input
            ref={nameInputRef}
            id="name"
            name="name"
            defaultValue={product?.name || ''}
            required
            disabled={pending}
            className={cn(submitErrors.name && 'border-destructive')}
            aria-invalid={submitErrors.name ? true : undefined}
            aria-describedby={submitErrors.name ? 'name-error' : undefined}
            onChange={() => {
              if (submitErrors.name) setSubmitErrors((s) => ({ ...s, name: undefined }))
            }}
          />
          {submitErrors.name
            ? (
              <p id="name-error" className="text-sm text-destructive" role="alert">
                {submitErrors.name}
              </p>
            )
            : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="barcode">Código de barras</Label>
          <div className="relative">
            <Input
              id="barcode"
              name="barcode"
              className="pr-10"
              defaultValue={product?.barcode || ''}
              disabled={pending}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
              onClick={() => {
                const el = document.getElementById('barcode') as HTMLInputElement | null
                if (el) el.value = generateEAN13()
              }}
              disabled={pending}
              aria-label="Gerar código de barras (EAN-13)"
            >
              <Barcode className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="pricing-tag">Tag de precificação</Label>
          <Select
            value={pricingTagId || '__none__'}
            onValueChange={handlePricingTagChange}
            disabled={pending}
          >
            <SelectTrigger id="pricing-tag" className="w-full">
              <SelectValue placeholder="Nenhuma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhuma</SelectItem>
              {pricingTags.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="compatible-model-search">Modelos compatíveis</Label>
          <div className="relative space-y-1.5">
            {compatibleModels.length > 0 ? (
              <div className="flex flex-wrap gap-2 rounded-md border border-primary/20 bg-primary/5 p-2">
                {compatibleModels.map((model) => (
                  <span
                    key={model.id}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-primary/20 bg-background px-2 py-1 text-xs"
                    title={model.label}
                  >
                    <span className="truncate">{model.label}</span>
                    <button
                      type="button"
                      className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={() => removeCompatibleModel(model.id)}
                      disabled={pending}
                      aria-label={`Remover modelo ${model.label}`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="relative">
              <Input
                id="compatible-model-search"
                placeholder="Ex.: M12 Samsung ou Galaxy A54 (mín. 2 caracteres)…"
                value={deviceModelQuery}
                onChange={(e) => setDeviceModelQuery(e.target.value)}
                onBlur={() => {
                  deviceCompatBlurRef.current = setTimeout(() => setCompatibleSuggestions([]), 150)
                }}
                onFocus={() => {
                  if (deviceCompatBlurRef.current) {
                    clearTimeout(deviceCompatBlurRef.current)
                    deviceCompatBlurRef.current = null
                  }
                }}
                disabled={pending || deviceCatalogLoading}
                autoComplete="off"
              />
              {deviceCatalogLoading ? (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  Carregando…
                </span>
              ) : null}
              {compatibleSuggestions.length > 0 ? (
                <ul className="absolute z-20 mt-1 max-h-52 w-full list-none overflow-auto rounded-md border bg-popover p-0 py-1 shadow-md">
                  {compatibleSuggestions.map((opt) => {
                    const alreadySelected = compatibleModels.some((m) => m.id === opt.value)
                    return (
                      <li key={opt.value}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handlePickCompatibleModel(opt)}
                          disabled={alreadySelected}
                        >
                          {opt.label}{alreadySelected ? ' (já selecionado)' : ''}
                        </button>
                      </li>
                    )
                  })}
                  {compatibleSuggestions.length === 50 ? (
                    <li className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                      Lista limitada a 50 itens — refine a busca se não encontrar o modelo.
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
            {!deviceCatalogLoading && deviceModelQuery.trim().length > 0 && deviceModelQuery.trim().length < 2 ? (
              <p className="text-xs text-muted-foreground">Mínimo 2 caracteres.</p>
            ) : null}
            {!deviceCatalogLoading && deviceModelQuery.trim().length >= 2 && compatibleSuggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum modelo encontrado.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="product-image-url">URL da imagem (capa)</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Input
            id="product-image-url"
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            disabled={pending}
            className="min-w-0 flex-1 font-mono text-sm"
          />
          {mode === 'edit' && variationChildCount > 0 && onApplyImageToVariationChildren
            ? (
              <Button
                type="button"
                variant="secondary"
                className="h-10 shrink-0 whitespace-nowrap"
                disabled={pending || applyImageToChildrenBusy}
                onClick={() => void onApplyImageToVariationChildren(imageUrl.trim() || null)}
              >
                {applyImageToChildrenBusy
                  ? 'Aplicando…'
                  : `Aplicar nas variações (${variationChildCount})`}
              </Button>
            )
            : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Endereço público da imagem usada na listagem. Deixe vazio para remover.
        </p>
      </div>

      <Dialog open={tagSuggestOpen} onOpenChange={setTagSuggestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Preço de venda sugerido</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Com base no custo informado e na regra da tag selecionada, sugerimos o preço abaixo. Você pode ajustar antes de aplicar.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="tag-suggest-price">Preço de venda</Label>
            <Input
              id="tag-suggest-price"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0,00"
              value={tagSuggestDraft}
              onChange={(e) => setTagSuggestDraft(formatMoneyInput(e.target.value))}
              className="tabular-nums"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setTagSuggestOpen(false)}>
              Manter valor atual
            </Button>
            <Button type="button" onClick={confirmTagSuggestedPrice}>
              Usar este preço
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mode === 'create' && (
        <div className="space-y-2">
          <Label htmlFor="initialStock">Estoque inicial (quantidade)</Label>
          <Input
            id="initialStock"
            name="initialStock"
            type="number"
            min="0"
            defaultValue="0"
            disabled={pending || kind === 'service'}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="isActive"
          checked={isActive}
          onCheckedChange={(c) => setIsActive(c === true)}
          disabled={pending}
        />
        <Label htmlFor="isActive">Ativo</Label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  )

  if (embed) {
    return formInner
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {formInner}
        </CardContent>
      </Card>
    </div>
  )
}
