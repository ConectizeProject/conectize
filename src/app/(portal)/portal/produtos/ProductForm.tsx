'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { suggestedSaleCents } from '@/lib/pricing/suggested-sale-cents'

type ProductFormProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  description: string | null
  salePriceCents: number | null
  costPriceCents: number | null
  pricingTagId: string | null
  partsFamily: string | null
  isActive: boolean
}

type PricingTagRow = {
  id: string
  name: string
  parts_family: string | null
  margin_bps: number | null
  min_suggested_sale_cents: number | null
}

type DeviceBrand = { id: string; name: string | null }
type DeviceType = { id: string; name: string | null }
type DeviceModelOption = {
  id: string
  model: string | null
  brand: string | null
  device_type: string | null
}

type CompatibleEntry = { id: string; label: string }

const PARTS_FAMILY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Herdar da tag (padrão)' },
  { value: 'display', label: 'Display' },
  { value: 'glass', label: 'Vidro' },
  { value: 'battery', label: 'Bateria' },
  { value: 'connector', label: 'Conector' },
]

function formatBrl (cents: number | null) {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type Props = {
  mode: 'create' | 'edit'
  product?: ProductFormProduct
  initialCompatibleModels?: CompatibleEntry[]
  action: (formData: FormData) => Promise<void>
}

export function ProductForm ({ mode, product, initialCompatibleModels, action }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [pricingTags, setPricingTags] = useState<PricingTagRow[]>([])
  const [pricingTagId, setPricingTagId] = useState(() => product?.pricingTagId || '')
  const [partsFamily, setPartsFamily] = useState(() => product?.partsFamily || '')
  const [saleReais, setSaleReais] = useState(() => {
    if (typeof product?.salePriceCents === 'number') {
      return (product.salePriceCents / 100).toFixed(2)
    }
    return ''
  })

  const [brands, setBrands] = useState<DeviceBrand[]>([])
  const [types, setTypes] = useState<DeviceType[]>([])
  const [models, setModels] = useState<DeviceModelOption[]>([])
  const [brandId, setBrandId] = useState('')
  const [deviceTypeId, setDeviceTypeId] = useState('')
  const [pickModelId, setPickModelId] = useState('')
  const [compatibleEntries, setCompatibleEntries] = useState<CompatibleEntry[]>(() =>
    initialCompatibleModels && initialCompatibleModels.length > 0 ? [...initialCompatibleModels] : [],
  )

  useEffect(() => {
    if (initialCompatibleModels && initialCompatibleModels.length > 0) {
      setCompatibleEntries([...initialCompatibleModels])
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

  const loadBrands = useCallback(async () => {
    const res = await fetch('/api/portal/device-brands')
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) return
    setBrands((json.deviceBrands || []) as DeviceBrand[])
  }, [])

  const loadTypes = useCallback(async (bid: string) => {
    if (!bid) {
      setTypes([])
      return
    }
    const res = await fetch(`/api/portal/device-types?brandId=${encodeURIComponent(bid)}`)
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) return
    setTypes((json.deviceTypes || []) as DeviceType[])
  }, [])

  const loadModels = useCallback(async (tid: string) => {
    if (!tid) {
      setModels([])
      return
    }
    const res = await fetch(`/api/portal/device-models?deviceTypeId=${encodeURIComponent(tid)}`)
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) return
    setModels((json.deviceModels || []) as DeviceModelOption[])
  }, [])

  useEffect(() => {
    void loadBrands()
  }, [loadBrands])

  useEffect(() => {
    void loadTypes(brandId)
  }, [brandId, loadTypes])

  useEffect(() => {
    void loadModels(deviceTypeId)
  }, [deviceTypeId, loadModels])

  const selectedTag = useMemo(
    () => pricingTags.find((t) => t.id === pricingTagId) || null,
    [pricingTags, pricingTagId],
  )

  const previewSuggestedCents = useMemo(() => {
    const saleCents =
      saleReais.trim() === '' ? null : Math.round(Number(saleReais.replace(',', '.')) * 100)
    if (saleCents == null || !Number.isFinite(saleCents) || saleCents <= 0) return null
    if (!selectedTag) return null
    const margin = selectedTag.margin_bps != null ? Number(selectedTag.margin_bps) : 0
    const minC = selectedTag.min_suggested_sale_cents
    return suggestedSaleCents({
      baseSaleCents: saleCents,
      marginBps: margin,
      minSuggestedSaleCents: minC,
    })
  }, [saleReais, selectedTag])

  function addPickedModel () {
    if (!pickModelId) return
    const m = models.find((x) => x.id === pickModelId)
    const labelParts = [m?.brand, m?.device_type, m?.model].filter(Boolean).map((x) => String(x))
    const label = labelParts.join(' · ') || pickModelId
    setCompatibleEntries((prev) => {
      if (prev.some((p) => p.id === pickModelId)) return prev
      return [...prev, { id: pickModelId, label }]
    })
    setPickModelId('')
  }

  function removeCompatible (id: string) {
    setCompatibleEntries((prev) => prev.filter((e) => e.id !== id))
  }

  async function handleSubmit (event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('compatibleModelIds', JSON.stringify(compatibleEntries.map((e) => e.id)))
    formData.set('pricingTagId', pricingTagId)
    formData.set('partsFamily', partsFamily || '')
    setPending(true)
    try {
      await action(formData)
    } finally {
      setPending(false)
    }
  }

  const title = mode === 'create' ? 'Novo produto/serviço' : 'Editar produto/serviço'

  return (
    <div className="max-w-2xl space-y-4">
      <Button variant="ghost" size="sm" type="button" onClick={() => router.back()}>
        Voltar
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={product?.name || ''}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  name="sku"
                  defaultValue={product?.sku || ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode">Código de barras</Label>
                <Input
                  id="barcode"
                  name="barcode"
                  defaultValue={product?.barcode || ''}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="salePrice">Preço de venda (R$)</Label>
                <Input
                  id="salePrice"
                  name="salePrice"
                  type="text"
                  inputMode="decimal"
                  value={saleReais}
                  onChange={(e) => setSaleReais(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPrice">Custo (R$)</Label>
                <Input
                  id="costPrice"
                  name="costPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={
                    typeof product?.costPriceCents === 'number'
                      ? (product.costPriceCents / 100).toFixed(2)
                      : ''
                  }
                />
              </div>
            </div>

            <Card className="border-dashed bg-muted/30">
              <CardHeader className="space-y-1 py-3">
                <CardTitle className="text-base">Precificação comercial</CardTitle>
                <CardDescription className="text-xs">
                  Tag usada no catálogo do lojista; família no produto sobrescreve a da tag quando preenchida.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="grid gap-2">
                  <Label>Tag de precificação</Label>
                  <Select
                    value={pricingTagId || '__none__'}
                    onValueChange={(v) => setPricingTagId(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger className="w-full">
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
                <div className="grid gap-2">
                  <Label htmlFor="partsFamily">Família (opcional no produto)</Label>
                  <select
                    id="partsFamily"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={partsFamily}
                    onChange={(e) => setPartsFamily(e.target.value)}
                  >
                    {PARTS_FAMILY_OPTIONS.map((o) => (
                      <option key={o.value || 'inherit'} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="rounded-md border bg-background px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Preview sugerido ao consumidor: </span>
                  <span className="font-medium tabular-nums">{formatBrl(previewSuggestedCents)}</span>
                  {!selectedTag ? (
                    <span className="ml-2 text-xs text-muted-foreground">(selecione uma tag e um preço de venda)</span>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed bg-muted/30">
              <CardHeader className="space-y-1 py-3">
                <CardTitle className="text-base">Modelos compatíveis</CardTitle>
                <CardDescription className="text-xs">
                  Aparelhos em que este item aparece nos filtros do catálogo comercial.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="grid min-w-[10rem] flex-1 gap-1 text-sm">
                    <span className="text-muted-foreground">Marca</span>
                    <Select value={brandId || '__all__'} onValueChange={(v) => {
                      const next = v === '__all__' ? '' : v
                      setBrandId(next)
                      setDeviceTypeId('')
                      setPickModelId('')
                    }}>
                      <SelectTrigger><SelectValue placeholder="Marca" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Selecione…</SelectItem>
                        {brands.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{String(b.name || '').trim() || b.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid min-w-[10rem] flex-1 gap-1 text-sm">
                    <span className="text-muted-foreground">Tipo</span>
                    <Select
                      value={deviceTypeId || '__all__'}
                      disabled={!brandId}
                      onValueChange={(v) => {
                        setDeviceTypeId(v === '__all__' ? '' : v)
                        setPickModelId('')
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Selecione…</SelectItem>
                        {types.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{String(t.name || '').trim() || t.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="grid min-w-[12rem] flex-1 gap-1 text-sm">
                    <span className="text-muted-foreground">Modelo</span>
                    <Select
                      value={pickModelId || '__pick__'}
                      disabled={!deviceTypeId}
                      onValueChange={(v) => setPickModelId(v === '__pick__' ? '' : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Modelo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__pick__">Selecione…</SelectItem>
                        {models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {String(m.model || '').trim() || m.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={addPickedModel} disabled={!pickModelId}>
                    Incluir modelo
                  </Button>
                </div>
                {compatibleEntries.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {compatibleEntries.map((e) => (
                      <Badge key={e.id} variant="secondary" className="gap-1 pr-1 font-normal">
                        <span className="max-w-[14rem] truncate">{e.label}</span>
                        <button
                          type="button"
                          className="rounded-sm p-0.5 hover:bg-muted"
                          onClick={() => removeCompatible(e.id)}
                          aria-label={`Remover ${e.label}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum modelo vinculado — o item não aparece nos filtros por aparelho.</p>
                )}
              </CardContent>
            </Card>

            {mode === 'create' && (
              <div className="space-y-2">
                <Label htmlFor="initialStock">Estoque inicial (quantidade)</Label>
                <Input
                  id="initialStock"
                  name="initialStock"
                  type="number"
                  min="0"
                  defaultValue="0"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                name="isActive"
                defaultChecked={product ? product.isActive : true}
              />
              <Label htmlFor="isActive">Ativo</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/portal/produtos?tab=gestao')}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
