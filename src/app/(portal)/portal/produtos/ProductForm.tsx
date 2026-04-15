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
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'

export type ProductFormProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  description: string | null
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
  onSubmit: (payload: ProductFormSubmitPayload) => Promise<void>
  onCancel: () => void
}

export function ProductForm ({
  mode,
  product,
  initialCompatibleModels,
  defaultKind = 'product',
  embed = false,
  onSubmit,
  onCancel,
}: Props) {
  const [pending, setPending] = useState(false)
  const [pricingTags, setPricingTags] = useState<PricingTagRow[]>([])
  const [pricingTagId, setPricingTagId] = useState(() => product?.pricingTagId || '')
  const [kind, setKind] = useState<'product' | 'service'>(() => {
    if (product?.kind === 'service') return 'service'
    if (product?.kind === 'product') return 'product'
    return defaultKind
  })
  const [description, setDescription] = useState(() => product?.description || '')
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

  const [compatibleModel, setCompatibleModel] = useState<CompatibleEntry | null>(() =>
    initialCompatibleModels && initialCompatibleModels.length > 0 ? initialCompatibleModels[0] : null,
  )

  const [deviceCatalog, setDeviceCatalog] = useState<DeviceCatalogRow[]>([])
  const [deviceCatalogLoading, setDeviceCatalogLoading] = useState(true)
  const [deviceModelQuery, setDeviceModelQuery] = useState('')
  const [compatibleSuggestions, setCompatibleSuggestions] = useState<{ value: string; label: string }[]>([])
  const deviceCompatBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [tagSuggestOpen, setTagSuggestOpen] = useState(false)
  const [tagSuggestDraft, setTagSuggestDraft] = useState('')

  useEffect(() => {
    if (initialCompatibleModels && initialCompatibleModels.length > 0) {
      setCompatibleModel(initialCompatibleModels[0])
    } else {
      setCompatibleModel(null)
    }
  }, [initialCompatibleModels])

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
  }, [])

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

  useEffect(() => {
    const q = deviceModelQuery.trim().toLowerCase()
    if (q.length < 2) {
      setCompatibleSuggestions([])
      return
    }
    const next = deviceOptions.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 50)
    setCompatibleSuggestions(next)
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
    if (c === 'invalid' || c === null) return
    setSaleReais(maskedFromCents(c))
    setTagSuggestOpen(false)
  }

  function applySuggestedSalePrice () {
    if (previewSuggestedCents == null) return
    setSaleReais(maskedFromCents(previewSuggestedCents))
  }

  function handlePickCompatibleModel (opt: { value: string; label: string }) {
    setCompatibleModel({ id: opt.value, label: opt.label })
    setDeviceModelQuery('')
    setCompatibleSuggestions([])
  }

  function clearCompatibleModel () {
    setCompatibleModel(null)
    setDeviceModelQuery('')
    setCompatibleSuggestions([])
  }

  async function handleSubmit (event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('name') || '').trim()
    if (!name) return

    const saleCentsParsed = parseMaskedMoneyToCents(saleReais)
    if (saleCentsParsed === 'invalid') return
    const salePrice = saleCentsParsed == null ? 0 : saleCentsParsed / 100

    const costCentsParsed = parseMaskedMoneyToCents(costReais)
    if (costCentsParsed === 'invalid') return
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
      kind,
      salePrice,
      costPrice,
      isActive,
      pricingTagId: pricingTagId || null,
      compatibleModelIds: compatibleModel ? [compatibleModel.id] : [],
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
            onChange={(e) => setCostReais(formatMoneyInput(e.target.value))}
            disabled={pending}
            className="tabular-nums"
          />
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
            onChange={(e) => setSaleReais(formatMoneyInput(e.target.value))}
            disabled={pending}
            className="tabular-nums"
          />
          {showSuggestedSaleHint ? (
            <p className="flex flex-wrap items-center gap-0.5 text-[11px] leading-tight text-muted-foreground">
              <span>
                Sg.{' '}
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
            id="name"
            name="name"
            defaultValue={product?.name || ''}
            required
            disabled={pending}
          />
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
          <Label htmlFor={compatibleModel ? undefined : 'compatible-model-search'}>Modelo compatível</Label>
          {compatibleModel ? (
            <div className="flex min-h-10 items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-sm shadow-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-foreground" title={compatibleModel.label}>
                {compatibleModel.label}
              </span>
              <button
                type="button"
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                onClick={clearCompatibleModel}
                disabled={pending}
                aria-label="Remover modelo selecionado"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : (
            <div className="relative space-y-1.5">
              <div className="relative">
                <Input
                  id="compatible-model-search"
                  placeholder="Marca, tipo ou modelo (mín. 2 caracteres)…"
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
                    {compatibleSuggestions.map((opt) => (
                      <li key={opt.value}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handlePickCompatibleModel(opt)}
                        >
                          {opt.label}
                        </button>
                      </li>
                    ))}
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
          )}
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
