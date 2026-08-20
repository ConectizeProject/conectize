'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Barcode, Check, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Switch } from '@/components/ui/switch'
import { suggestedSaleCents } from '@/lib/pricing/suggested-sale-cents'
import { composePortalVariationDisplayName } from '@/lib/products/variation-display-name'
import { cn } from '@/lib/utils'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import { toast } from '@/hooks/use-toast'
import { cestPairingMessage, evaluateCestForNcm, type CestSuggestion, type CestTableStatus } from '@/lib/fiscal/cest'
import { maskFci, normalizeOptionalFci, originRequiresFci } from '@/lib/fiscal/fci'
import { normalizeOptionalGtin } from '@/lib/fiscal/gtin'
import { normalizeOptionalCest, normalizeOptionalNcm } from '@/lib/fiscal/ncm'

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
  ncm?: string | null
  cest?: string | null
  cfop?: string | null
  fiscalOrigin?: number | null
  fci?: string | null
  fiscalUnit?: string | null
  icmsCsosn?: string | null
  icmsCst?: string | null
  pisCst?: string | null
  cofinsCst?: string | null
  variationAttributeKeys?: string[]
  variationAttributeValues?: Record<string, string>
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
  ncm: string | null
  cest: string | null
  cfop: string | null
  fiscalOrigin: number | null
  fci: string | null
  fiscalUnit: string | null
  icmsCsosn: string | null
  icmsCst: string | null
  pisCst: string | null
  cofinsCst: string | null
  variationAttributeKeys?: string[]
  variationAttributeValues?: Record<string, string>
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

function FormSection ({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border/80 bg-card text-card-foreground">
      <div className="space-y-1 border-b border-border/60 px-4 py-3 sm:px-5">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  )
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

const FISCAL_ORIGIN_OPTIONS = [
  { value: '0', label: '0 - Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8' },
  { value: '1', label: '1 - Estrangeira - Importação direta, exceto a indicada no código 6' },
  { value: '2', label: '2 - Estrangeira - Adquirida no mercado interno, exceto a indicada no código 7' },
  { value: '3', label: '3 - Nacional, mercadoria ou bem com Conteúdo de Importação superior a 40% e inferior ou igual a 70%' },
  { value: '4', label: '4 - Nacional, produção conforme processos produtivos básicos dos Ajustes' },
  { value: '5', label: '5 - Nacional, mercadoria ou bem com Conteúdo de Importação inferior ou igual a 40%' },
  { value: '6', label: '6 - Estrangeira - Importação direta, sem similar nacional, constante em lista da CAMEX' },
  { value: '7', label: '7 - Estrangeira - Adquirida no mercado interno, sem similar nacional, constante em lista da CAMEX' },
  { value: '8', label: '8 - Nacional, mercadoria ou bem com Conteúdo de Importação superior a 70%' },
]

function fiscalDigits (value: unknown, maxLength: number) {
  return String(value ?? '').replace(/\D/g, '').slice(0, maxLength)
}

function maskNcm (value: unknown) {
  const digits = fiscalDigits(value, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`
}

function maskCest (value: unknown) {
  const digits = fiscalDigits(value, 7)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
}

function normalizeFiscalOriginSelectValue (value: unknown) {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '0'
  const safe = Math.min(8, Math.max(0, Math.round(n)))
  return String(safe)
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
  /** Criação vinculada a um pai (nova variação): esconde editor de chaves no filho. */
  creatingAsVariation?: boolean
  /** Nome do produto pai (pré-visualização do título composto na variação). */
  parentProductNameForVariation?: string | null
  /** Chaves definidas no pai; quando não vazio, o nome da variação vem dos valores destes atributos. */
  parentVariationAttributeKeys?: string[]
  /** true quando `product` é uma variação (edição direta do filho). */
  isVariation?: boolean
  /**
   * Só edição de variação: elemento na aba «Variações» do diálogo onde os campos de atributo são renderizados (portal).
   */
  variationAttributesPortalEl?: HTMLElement | null
  /**
   * Só edição do produto pai (não variação): aba «Variações» — cartão «Atributos das variações» (portal).
   */
  variationAttributeKeysPortalEl?: HTMLElement | null
  /**
   * Edição de produto pai com abas: o editor de chaves só aparece na aba Variações (aguarda o alvo do portal).
   */
  embedVariationKeysInVariationsTab?: boolean
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
  creatingAsVariation = false,
  parentProductNameForVariation = null,
  parentVariationAttributeKeys = [],
  isVariation = false,
  variationAttributesPortalEl = null,
  variationAttributeKeysPortalEl = null,
  embedVariationKeysInVariationsTab = false,
}: Props) {
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [submitErrors, setSubmitErrors] = useState<{
    name?: string
    salePrice?: string
    costPrice?: string
    barcode?: string
    ncm?: string
    cest?: string
    fci?: string
  }>({})
  const [pending, setPending] = useState(false)
  const [pricingTags, setPricingTags] = useState<PricingTagRow[]>([])
  const [pricingTagId, setPricingTagId] = useState(() => product?.pricingTagId || '')
  const [kind, setKind] = useState<'product' | 'service'>(() => {
    if (product?.kind === 'service') return 'service'
    if (product?.kind === 'product') return 'product'
    return defaultKind
  })
  const [ncm, setNcm] = useState(() => maskNcm(product?.ncm || ''))
  const [cest, setCest] = useState(() => maskCest(product?.cest || ''))
  const [fiscalOrigin, setFiscalOrigin] = useState(() => normalizeFiscalOriginSelectValue(product?.fiscalOrigin ?? 0))
  const [fci, setFci] = useState(() => maskFci(product?.fci || ''))
  const [cestSuggestions, setCestSuggestions] = useState<CestSuggestion[]>([])
  const [cestTableStatus, setCestTableStatus] = useState<CestTableStatus>('unknown')
  const [isLoadingCestSuggestions, setIsLoadingCestSuggestions] = useState(false)
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

  const useAttrMode = Boolean(
    (isVariation || creatingAsVariation) &&
    parentProductNameForVariation &&
    parentVariationAttributeKeys.length > 0,
  )

  const [attrValues, setAttrValues] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!useAttrMode) return
    const next: Record<string, string> = {}
    for (const k of parentVariationAttributeKeys) {
      next[k] = String(product?.variationAttributeValues?.[k] ?? '').trim()
    }
    setAttrValues(next)
  }, [
    useAttrMode,
    product?.id,
    product?.variationAttributeValues,
    parentVariationAttributeKeys,
  ])

  const composedVariationName = useMemo(() => {
    if (!useAttrMode || !parentProductNameForVariation) return ''
    return composePortalVariationDisplayName(
      parentProductNameForVariation,
      parentVariationAttributeKeys,
      attrValues,
    )
  }, [useAttrMode, parentProductNameForVariation, parentVariationAttributeKeys, attrValues])

  const showVariationKeyEditor =
    !creatingAsVariation &&
    !isVariation &&
    kind === 'product' &&
    (mode === 'edit' || mode === 'create')

  const [variationKeyDrafts, setVariationKeyDrafts] = useState<string[]>(() =>
    Array.isArray(product?.variationAttributeKeys) && product.variationAttributeKeys.length > 0
      ? [...product.variationAttributeKeys]
      : [],
  )
  useEffect(() => {
    if (!product?.id) return
    setVariationKeyDrafts(
      Array.isArray(product.variationAttributeKeys) && product.variationAttributeKeys.length > 0
        ? [...product.variationAttributeKeys]
        : [],
    )
  }, [product?.id, product?.variationAttributeKeys])

  const [tagSuggestOpen, setTagSuggestOpen] = useState(false)
  const [tagSuggestDraft, setTagSuggestDraft] = useState('')

  useEffect(() => {
    setCompatibleModels(Array.isArray(initialCompatibleModels) ? [...initialCompatibleModels] : [])
  }, [initialCompatibleModels])

  useEffect(() => {
    if (!product?.id) return
    setNcm(maskNcm(product.ncm || ''))
    setCest(maskCest(product.cest || ''))
    setFiscalOrigin(normalizeFiscalOriginSelectValue(product.fiscalOrigin ?? 0))
    setFci(maskFci(product.fci || ''))
    setImageUrl(
      product.imageUrl != null && String(product.imageUrl).trim()
        ? String(product.imageUrl).trim()
        : '',
    )
  }, [product?.id, product?.ncm, product?.cest, product?.fiscalOrigin, product?.fci, product?.imageUrl])

  const ncmDigits = fiscalDigits(ncm, 8)

  useEffect(() => {
    if (kind !== 'product' || ncmDigits.length !== 8) {
      setCestSuggestions([])
      setCestTableStatus('unknown')
      setIsLoadingCestSuggestions(false)
      return
    }

    const controller = new AbortController()
    setIsLoadingCestSuggestions(true)

    void (async () => {
      try {
        const res = await fetch(`/api/portal/fiscal/cest-suggestions?ncm=${encodeURIComponent(ncmDigits)}`, {
          signal: controller.signal,
        })
        const json = await res.json().catch(() => null) as {
          ok?: boolean
          status?: CestTableStatus
          suggestions?: CestSuggestion[]
        } | null
        if (controller.signal.aborted) return
        const suggestions = res.ok && json?.ok && Array.isArray(json.suggestions) ? json.suggestions : []
        const status = json?.status === 'in' || json?.status === 'out' || json?.status === 'unknown'
          ? json.status
          : 'unknown'
        setCestSuggestions(suggestions)
        setCestTableStatus(status)
      } catch (err) {
        if (!controller.signal.aborted) {
          console.warn('[product form] cest suggestions failed', err)
          setCestSuggestions([])
          setCestTableStatus('unknown')
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingCestSuggestions(false)
      }
    })()

    return () => {
      controller.abort()
    }
  }, [kind, ncmDigits])

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
    const name = useAttrMode
      ? composedVariationName.trim()
      : String(formData.get('name') || '').trim()
    if (!name) {
      setSubmitErrors({
        name: useAttrMode
          ? 'Preencha todos os atributos da variação.'
          : 'Informe um nome para o produto ou serviço.',
      })
      if (!useAttrMode) queueMicrotask(() => nameInputRef.current?.focus())
      return
    }

    if (useAttrMode) {
      for (const k of parentVariationAttributeKeys) {
        if (!String(attrValues[k] || '').trim()) {
          setSubmitErrors({ name: `Informe o valor para «${k}».` })
          return
        }
      }
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

    const barcodeNormalized = normalizeOptionalGtin(formData.get('barcode'))
    if (barcodeNormalized === 'invalid') {
      setSubmitErrors({
        barcode: 'Informe um EAN/GTIN válido (8, 12, 13 ou 14 dígitos) ou deixe em branco.',
      })
      queueMicrotask(() => {
        const el = document.getElementById('barcode') as HTMLInputElement | null
        el?.focus()
      })
      return
    }

    const ncmNormalized = kind === 'product' ? normalizeOptionalNcm(ncm) : null
    if (ncmNormalized === 'invalid') {
      setSubmitErrors({
        ncm: 'Informe o NCM com 8 dígitos (0000.00.00) ou deixe em branco.',
      })
      queueMicrotask(() => {
        const el = document.getElementById('ncm') as HTMLInputElement | null
        el?.focus()
      })
      return
    }

    const cestNormalized = kind === 'product' ? normalizeOptionalCest(cest) : null
    if (cestNormalized === 'invalid') {
      setSubmitErrors({
        cest: 'Informe o CEST com 7 dígitos (00.000.00) ou deixe em branco.',
      })
      queueMicrotask(() => {
        const el = document.getElementById('cest') as HTMLInputElement | null
        el?.focus()
      })
      return
    }

    if (kind === 'product' && ncmNormalized && !isLoadingCestSuggestions) {
      const pairing = evaluateCestForNcm({
        status: cestTableStatus,
        allowedCests: cestSuggestions.map((item) => item.code),
        cest: cestNormalized,
      })
      if (pairing.ok === false) {
        setSubmitErrors({
          cest: cestPairingMessage(pairing.reason, {
            allowedCests: cestSuggestions.map((item) => item.code),
          }),
        })
        queueMicrotask(() => {
          const el = document.getElementById('cest') as HTMLInputElement | null
          el?.focus()
        })
        return
      }
    }

    const initialStockRaw = mode === 'create'
      ? Number(String(formData.get('initialStock') || '0').replace(',', '.'))
      : 0
    const initialStock = mode === 'create' && kind === 'product' && Number.isFinite(initialStockRaw) && initialStockRaw > 0
      ? Math.floor(initialStockRaw)
      : 0

    const fiscalOriginRaw = Number(fiscalOrigin)
    const fiscalOriginValue = kind === 'product' && Number.isFinite(fiscalOriginRaw)
      ? Math.min(8, Math.max(0, Math.round(fiscalOriginRaw)))
      : null

    const fciNormalized = kind === 'product' && originRequiresFci(fiscalOriginValue)
      ? normalizeOptionalFci(fci)
      : null
    if (fciNormalized === 'invalid' || (kind === 'product' && originRequiresFci(fiscalOriginValue) && fciNormalized == null)) {
      setSubmitErrors({
        fci: 'Informe o FCI no formato UUID (8-4-4-4-12). Obrigatório para origens 3, 5 e 8.',
      })
      queueMicrotask(() => {
        const el = document.getElementById('fci') as HTMLInputElement | null
        el?.focus()
      })
      return
    }

    const payload: ProductFormSubmitPayload = {
      name,
      sku: String(formData.get('sku') || '').trim() || null,
      barcode: barcodeNormalized,
      description: description.trim() || null,
      imageUrl: imageUrl.trim() || null,
      kind,
      salePrice,
      costPrice,
      isActive,
      pricingTagId: pricingTagId || null,
      compatibleModelIds: compatibleModels.map((m) => m.id),
      initialStock,
      ncm: kind === 'product' ? ncmNormalized : null,
      cest: kind === 'product' ? cestNormalized : null,
      cfop: kind === 'product' ? fiscalDigits(product?.cfop || '', 4) || null : null,
      fiscalOrigin: fiscalOriginValue,
      fci: kind === 'product' && fciNormalized !== 'invalid' ? fciNormalized : null,
      fiscalUnit: kind === 'product' ? String(formData.get('fiscalUnit') || '').trim() || null : null,
      icmsCsosn: kind === 'product' ? fiscalDigits(product?.icmsCsosn || '', 3) || null : null,
      icmsCst: kind === 'product' ? fiscalDigits(product?.icmsCst || '', 3) || null : null,
      pisCst: kind === 'product' ? fiscalDigits(product?.pisCst || '', 2) || null : null,
      cofinsCst: kind === 'product' ? fiscalDigits(product?.cofinsCst || '', 2) || null : null,
    }

    if (showVariationKeyEditor) {
      const seen = new Set<string>()
      const keys: string[] = []
      for (const raw of variationKeyDrafts) {
        const k = raw.trim().replace(/\s+/g, ' ')
        if (!k || k.length > 48) continue
        const low = k.toLowerCase()
        if (seen.has(low)) continue
        seen.add(low)
        keys.push(k)
        if (keys.length >= 8) break
      }
      payload.variationAttributeKeys = keys
    }

    if (useAttrMode) {
      const vals: Record<string, string> = {}
      for (const k of parentVariationAttributeKeys) {
        vals[k] = String(attrValues[k] || '').trim()
      }
      payload.variationAttributeValues = vals
    }

    setPending(true)
    try {
      await onSubmit(payload)
    } finally {
      setPending(false)
    }
  }

  function renderVariationKeysEditorSection () {
    return (
      <FormSection
        title="Atributos das variações"
        description="Ex.: Tamanho, Cor, Modelo. Em cada variação você informa o valor; o nome no catálogo fica «Nome do produto atributo:valor»."
      >
        <div className="space-y-2">
          {variationKeyDrafts.map((draft, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => {
                  const v = e.target.value
                  setVariationKeyDrafts((prev) => prev.map((x, i) => (i === idx ? v : x)))
                }}
                placeholder="Ex.: Tamanho"
                disabled={pending}
                aria-label={`Nome do atributo ${idx + 1}`}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 shrink-0"
                disabled={pending}
                onClick={() => setVariationKeyDrafts((prev) => prev.filter((_, i) => i !== idx))}
                aria-label={`Remover atributo ${idx + 1}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-9"
          disabled={pending || variationKeyDrafts.length >= 8}
          onClick={() => setVariationKeyDrafts((prev) => [...prev, ''])}
        >
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          Adicionar atributo
        </Button>
      </FormSection>
    )
  }

  const title = mode === 'create' ? 'Novo produto/serviço' : 'Editar produto/serviço'

  function renderVariationAttributesSection () {
    return (
      <div className="space-y-3">
        <Label id="variation-attrs-label">Atributos da variação</Label>
        <p className="text-xs text-muted-foreground">
          Nome composto no catálogo:{' '}
          <span className="font-medium text-foreground">{composedVariationName || '—'}</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {parentVariationAttributeKeys.map((attrKey) => (
            <div key={attrKey} className="space-y-2">
              <Label htmlFor={`attr-${attrKey}`}>{attrKey}</Label>
              <Input
                id={`attr-${attrKey}`}
                value={attrValues[attrKey] ?? ''}
                onChange={(e) => {
                  setAttrValues((prev) => ({ ...prev, [attrKey]: e.target.value }))
                  if (submitErrors.name) setSubmitErrors((s) => ({ ...s, name: undefined }))
                }}
                disabled={pending}
                placeholder={`Valor para ${attrKey}`}
                autoComplete="off"
              />
            </div>
          ))}
        </div>
        {submitErrors.name
          ? (
            <p className="text-sm text-destructive" role="alert">
              {submitErrors.name}
            </p>
          )
          : null}
      </div>
    )
  }

  const formInner = (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormSection
        title="Identidade"
        description="Tipo, nome e códigos usados no catálogo e na emissão fiscal."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="product-kind">Tipo</Label>
            <Select
              value={kind}
              onValueChange={(value) => setKind(value === 'service' ? 'service' : 'product')}
              disabled={pending}
            >
              <SelectTrigger id="product-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Produto</SelectItem>
                <SelectItem value="service">Serviço</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              name="sku"
              defaultValue={product?.sku || ''}
              disabled={pending}
              className="min-w-0"
            />
          </div>
        </div>

        {useAttrMode ? (
          variationAttributesPortalEl ? (
            <>
              {createPortal(renderVariationAttributesSection(), variationAttributesPortalEl)}
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2.5">
                <p className="text-sm text-muted-foreground">
                  Os atributos desta variação ficam na aba{' '}
                  <span className="font-medium text-foreground">Variações</span>
                  . Altere-os lá; em seguida pode salvar por aqui ou pela mesma aba.
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-3 rounded-md border border-border/70 bg-muted/15 p-4">
              <h4 className="text-sm font-semibold tracking-tight text-foreground">Variação</h4>
              {renderVariationAttributesSection()}
            </div>
          )
        ) : (
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
        )}

        <div className="space-y-2">
          <Label htmlFor="barcode">Código de barras</Label>
          <div className="relative">
            <Input
              id="barcode"
              name="barcode"
              inputMode="numeric"
              autoComplete="off"
              className={cn('pr-10', submitErrors.barcode && 'border-destructive')}
              defaultValue={product?.barcode || ''}
              disabled={pending}
              aria-invalid={submitErrors.barcode ? true : undefined}
              aria-describedby={submitErrors.barcode ? 'barcode-error' : 'barcode-hint'}
              onChange={() => {
                if (submitErrors.barcode) setSubmitErrors((s) => ({ ...s, barcode: undefined }))
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
              onClick={() => {
                const el = document.getElementById('barcode') as HTMLInputElement | null
                if (el) el.value = generateEAN13()
                if (submitErrors.barcode) setSubmitErrors((s) => ({ ...s, barcode: undefined }))
              }}
              disabled={pending}
              aria-label="Gerar código de barras (EAN-13)"
            >
              <Barcode className="h-4 w-4" />
            </Button>
          </div>
          {submitErrors.barcode
            ? (
              <p id="barcode-error" className="text-sm text-destructive" role="alert">
                {submitErrors.barcode}
              </p>
            )
            : (
              <p id="barcode-hint" className="text-xs text-muted-foreground">
                EAN-8, 12, 13 ou 14 com dígito verificador. Deixe em branco se não houver GTIN.
              </p>
            )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/15 px-3 py-2.5">
          <div className="min-w-0">
            <Label htmlFor="isActive" className="text-sm font-medium">
              Produto ativo
            </Label>
            <p className="text-xs text-muted-foreground">
              Inativos somem das listagens e do PDV.
            </p>
          </div>
          <Switch
            id="isActive"
            checked={isActive}
            onCheckedChange={(c) => setIsActive(c === true)}
            disabled={pending}
          />
        </div>
      </FormSection>

      <FormSection
        title="Preços"
        description="Custo, venda e regra de precificação sugerida."
      >
        <div className="grid gap-4 sm:grid-cols-2">
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
              <p className="flex flex-wrap items-center gap-1 text-xs leading-tight text-muted-foreground">
                <span>
                  Sugerido{' '}
                  <span className="tabular-nums font-medium text-foreground">{formatBrl(previewSuggestedCents)}</span>
                </span>
                <button
                  type="button"
                  className="inline-flex shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={applySuggestedSalePrice}
                  aria-label="Aplicar preço sugerido"
                >
                  <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                </button>
              </p>
            ) : null}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="pricing-tag">Tag de precificação</Label>
            <Select
              value={pricingTagId || '__none__'}
              onValueChange={handlePricingTagChange}
              disabled={pending}
            >
              <SelectTrigger id="pricing-tag" className="w-full sm:max-w-md">
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
        </div>
      </FormSection>

      <FormSection
        title="Catálogo"
        description="Descrição, modelos compatíveis e imagem de capa."
      >
        <div className="space-y-2">
          <Label htmlFor="compatible-model-search">Modelos compatíveis</Label>
          <div className="relative space-y-1.5">
            {compatibleModels.length > 0 ? (
              <div className="flex flex-wrap gap-2 rounded-md border border-border bg-muted/20 p-2">
                {compatibleModels.map((model) => (
                  <span
                    key={model.id}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs"
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {imageUrl.trim() ? (
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                <img
                  src={imageUrl.trim()}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.visibility = 'hidden'
                  }}
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1 space-y-2">
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
          </div>
        </div>

        {mode === 'create' && kind !== 'service' ? (
          <div className="space-y-2 sm:max-w-xs">
            <Label htmlFor="initialStock">Estoque inicial</Label>
            <Input
              id="initialStock"
              name="initialStock"
              type="number"
              min="0"
              defaultValue="0"
              disabled={pending}
            />
          </div>
        ) : null}
      </FormSection>

      {kind === 'product' ? (
        <FormSection
          title="Fiscal"
          description="Dados do item na NFC-e. CFOP, CSOSN, ICMS CST, PIS e COFINS vêm da natureza de operação. Itens sem NCM são bloqueados na emissão."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2 sm:col-span-2 lg:col-span-2">
              <Label htmlFor="origem">Origem</Label>
              <input type="hidden" name="fiscalOrigin" value={fiscalOrigin} />
              <Select
                value={fiscalOrigin}
                onValueChange={(value) => {
                  setFiscalOrigin(value)
                  if (!originRequiresFci(value)) {
                    setFci('')
                    if (submitErrors.fci) setSubmitErrors((s) => ({ ...s, fci: undefined }))
                  }
                }}
                disabled={pending}
              >
                <SelectTrigger id="origem" className="w-full">
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  {FISCAL_ORIGIN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {originRequiresFci(fiscalOrigin) ? (
              <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="fci">FCI</Label>
                <Input
                  id="fci"
                  name="fci"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={36}
                  value={fci}
                  onChange={(e) => {
                    setFci(maskFci(e.target.value))
                    if (submitErrors.fci) setSubmitErrors((s) => ({ ...s, fci: undefined }))
                  }}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  disabled={pending}
                  className={cn(submitErrors.fci && 'border-destructive')}
                  aria-invalid={submitErrors.fci ? true : undefined}
                  aria-describedby={submitErrors.fci ? 'fci-error' : 'fci-hint'}
                />
                {submitErrors.fci
                  ? (
                    <p id="fci-error" className="text-sm text-destructive" role="alert">
                      {submitErrors.fci}
                    </p>
                  )
                  : (
                    <p id="fci-hint" className="text-xs text-muted-foreground">
                      Ficha de Conteúdo de Importação. Obrigatória nas origens 3, 5 e 8.
                    </p>
                  )}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="ncm">NCM</Label>
              <Input
                id="ncm"
                name="ncm"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                value={ncm}
                onChange={(e) => {
                  setNcm(maskNcm(e.target.value))
                  if (submitErrors.ncm) setSubmitErrors((s) => ({ ...s, ncm: undefined }))
                }}
                placeholder="0000.00.00"
                disabled={pending}
                className={cn(submitErrors.ncm && 'border-destructive')}
                aria-invalid={submitErrors.ncm ? true : undefined}
                aria-describedby={submitErrors.ncm ? 'ncm-error' : 'ncm-hint'}
              />
              {submitErrors.ncm
                ? (
                  <p id="ncm-error" className="text-sm text-destructive" role="alert">
                    {submitErrors.ncm}
                  </p>
                )
                : (
                  <p id="ncm-hint" className="text-xs text-muted-foreground">
                    Máscara visual. A SEFAZ recebe só os 8 dígitos.
                  </p>
                )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cest">{cestTableStatus === 'in' ? 'CEST (obrigatório)' : 'CEST'}</Label>
              <Input
                id="cest"
                name="cest"
                list="cest-suggestions"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                value={cest}
                onChange={(e) => {
                  setCest(maskCest(e.target.value))
                  if (submitErrors.cest) setSubmitErrors((s) => ({ ...s, cest: undefined }))
                }}
                placeholder="00.000.00"
                disabled={pending}
                className={cn(submitErrors.cest && 'border-destructive')}
                aria-invalid={submitErrors.cest ? true : undefined}
                aria-describedby={submitErrors.cest ? 'cest-error' : undefined}
              />
              {submitErrors.cest
                ? (
                  <p id="cest-error" className="text-sm text-destructive" role="alert">
                    {submitErrors.cest}
                  </p>
                )
                : null}
              <datalist id="cest-suggestions">
                {cestSuggestions.map((suggestion) => (
                  <option key={suggestion.code} value={maskCest(suggestion.code)}>
                    {suggestion.label}
                  </option>
                ))}
              </datalist>
              {isLoadingCestSuggestions ? (
                <p className="text-xs text-muted-foreground">Buscando CESTs para o NCM...</p>
              ) : null}
              {!isLoadingCestSuggestions && ncmDigits.length === 8 && cestTableStatus === 'out' ? (
                <p className="text-xs text-muted-foreground">Este NCM não exige CEST. Deixe o campo em branco.</p>
              ) : null}
              {!isLoadingCestSuggestions && ncmDigits.length === 8 && cestTableStatus === 'in' && cestSuggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Este NCM exige CEST. Preencha o código de 7 dígitos.</p>
              ) : null}
              {!isLoadingCestSuggestions && ncmDigits.length === 8 && cestTableStatus === 'unknown' ? (
                <p className="text-xs text-muted-foreground">Não foi possível consultar a tabela CEST. Você pode preencher manualmente.</p>
              ) : null}
              {cestSuggestions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {cestSuggestions.slice(0, 5).map((suggestion) => (
                    <Button
                      key={suggestion.code}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto min-h-8 px-2 py-1 text-left text-xs"
                      title={suggestion.label}
                      onClick={() => setCest(maskCest(suggestion.code))}
                      disabled={pending}
                    >
                      {maskCest(suggestion.code)}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fiscalUnit">Unidade</Label>
              <Input id="fiscalUnit" name="fiscalUnit" maxLength={6} defaultValue={product?.fiscalUnit || 'UN'} disabled={pending} />
            </div>
          </div>
        </FormSection>
      ) : (
        <div className="rounded-lg border border-border/80 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
          Nota de serviço (NFS-e) fica para uma fase futura; serviços não entram na emissão de NFC-e.
        </div>
      )}

      {showVariationKeyEditor ? (
        embedVariationKeysInVariationsTab && mode === 'edit' ? (
          variationAttributeKeysPortalEl ? (
            <>
              {createPortal(renderVariationKeysEditorSection(), variationAttributeKeysPortalEl)}
              <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  O cartão <span className="font-medium text-foreground">Atributos das variações</span> está na aba{' '}
                  <span className="font-medium text-foreground">Variações</span>. Defina ou altere os atributos lá
                  antes de guardar.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              O editor de atributos abre na aba <span className="font-medium text-foreground">Variações</span>…
            </p>
          )
        ) : (
          renderVariationKeysEditorSection()
        )
      ) : null}

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

      <div className="sticky bottom-0 z-10 -mx-1 flex justify-end gap-2 border-t border-border/80 bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
    <div className="max-w-2xl space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">
          Preencha os dados do item. Campos fiscais são obrigatórios para emissão de NFC-e.
        </p>
      </div>
      {formInner}
    </div>
  )
}
