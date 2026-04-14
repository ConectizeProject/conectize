'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type DeviceBrand = { id: string; name: string | null }
type DeviceType = { id: string; name: string | null }
type DeviceModel = { id: string; model: string | null }

type CatalogRow = {
  productId: string
  productName: string
  productKind: string
  salePriceCents: number | null
  suggestedSaleCents: number | null
  pricingTagName: string | null
  partsFamily: string | null
  deviceModelLabel: string | null
  brandName: string | null
}

const FAMILY_LABEL: Record<string, string> = {
  display: 'Display',
  glass: 'Vidro',
  battery: 'Bateria',
  connector: 'Conector',
}

function formatBrl (cents: number | null) {
  if (cents == null) return '—'
  const v = cents / 100
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type GroupBlock = {
  key: string
  titleTag: string
  titleFamily: string
  rows: CatalogRow[]
}

export function TabelaPrecosLojistaClient () {
  const [brands, setBrands] = useState<DeviceBrand[]>([])
  const [types, setTypes] = useState<DeviceType[]>([])
  const [models, setModels] = useState<DeviceModel[]>([])
  const [brandId, setBrandId] = useState('')
  const [deviceTypeId, setDeviceTypeId] = useState('')
  const [deviceModelId, setDeviceModelId] = useState('')
  const [rows, setRows] = useState<CatalogRow[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMeta = useCallback(async (bid: string | null, tid: string | null) => {
    setLoadingMeta(true)
    setError(null)
    const qs = new URLSearchParams()
    if (bid) qs.set('brandId', bid)
    if (tid) qs.set('deviceTypeId', tid)
    const res = await fetch(`/api/portal/lojista/device-filters?${qs.toString()}`)
    const json = await res.json().catch(() => null)
    setLoadingMeta(false)
    if (!res.ok || !json?.ok) {
      setError('Não foi possível carregar filtros de aparelho.')
      return
    }
    setBrands((json.deviceBrands || []) as DeviceBrand[])
    if (json.deviceTypes) setTypes(json.deviceTypes as DeviceType[])
    else setTypes([])
    if (json.deviceModels) setModels(json.deviceModels as DeviceModel[])
    else setModels([])
  }, [])

  useEffect(() => {
    void loadMeta(null, null)
  }, [loadMeta])

  useEffect(() => {
    if (!brandId) {
      setTypes([])
      setDeviceTypeId('')
      setModels([])
      setDeviceModelId('')
      return
    }
    void (async () => {
      await loadMeta(brandId, null)
    })()
  }, [brandId, loadMeta])

  useEffect(() => {
    if (!deviceTypeId) {
      setModels([])
      setDeviceModelId('')
      return
    }
    void (async () => {
      await loadMeta(brandId, deviceTypeId)
    })()
  }, [deviceTypeId, brandId, loadMeta])

  const fetchPrices = useCallback(async () => {
    setLoadingRows(true)
    setError(null)
    const qs = new URLSearchParams()
    if (brandId) qs.set('brandId', brandId)
    if (deviceTypeId) qs.set('deviceTypeId', deviceTypeId)
    if (deviceModelId) qs.set('deviceModelId', deviceModelId)
    const res = await fetch(`/api/portal/lojista/catalogo-precos?${qs.toString()}`)
    const json = await res.json().catch(() => null)
    setLoadingRows(false)
    if (!res.ok || !json?.ok) {
      setError('Não foi possível carregar preços.')
      setRows([])
      return
    }
    const raw = (json.items || []) as Record<string, unknown>[]
    setRows(raw.map((r) => ({
      productId: String(r.productId),
      productName: String(r.productName),
      productKind: String(r.productKind),
      salePriceCents: typeof r.salePriceCents === 'number' ? r.salePriceCents : null,
      suggestedSaleCents: typeof r.suggestedSaleCents === 'number' ? r.suggestedSaleCents : null,
      pricingTagName: r.pricingTagName != null ? String(r.pricingTagName) : null,
      partsFamily: r.partsFamily != null ? String(r.partsFamily) : null,
      deviceModelLabel: r.deviceModelLabel != null ? String(r.deviceModelLabel) : null,
      brandName: r.brandName != null ? String(r.brandName) : null,
    })))
  }, [brandId, deviceTypeId, deviceModelId])

  useEffect(() => {
    void fetchPrices()
  }, [fetchPrices])

  const groups = useMemo((): GroupBlock[] => {
    const map = new Map<string, CatalogRow[]>()
    for (const r of rows) {
      const tag = (r.pricingTagName || 'Sem tag').trim() || 'Sem tag'
      const famRaw = (r.partsFamily || '').trim().toLowerCase()
      const famLabel = famRaw ? (FAMILY_LABEL[famRaw] || famRaw) : 'Família geral'
      const key = `${tag}__${famRaw || '_'}`
      const list = map.get(key) || []
      list.push(r)
      map.set(key, list)
    }
    return [...map.entries()].map(([key, gRows]) => {
      const first = gRows[0]
      const tag = (first.pricingTagName || 'Sem tag').trim() || 'Sem tag'
      const famRaw = (first.partsFamily || '').trim().toLowerCase()
      const famLabel = famRaw ? (FAMILY_LABEL[famRaw] || famRaw) : 'Família geral'
      return { key, titleTag: tag, titleFamily: famLabel, rows: gRows }
    }).sort((a, b) => a.titleTag.localeCompare(b.titleTag, 'pt') || a.titleFamily.localeCompare(b.titleFamily, 'pt'))
  }, [rows])

  const defaultAccordion = groups.length > 0 ? [groups[0].key] : undefined

  return (
    <div className="space-y-4">
      <Card className="min-w-0 max-w-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Filtros por aparelho</CardTitle>
          <CardDescription>
            Marca, tipo e modelo em cascata. Os preços são atualizados automaticamente ao mudar os filtros.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Marca</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={brandId}
                disabled={loadingMeta}
                onChange={(e) => {
                  setBrandId(e.target.value)
                  setDeviceTypeId('')
                  setDeviceModelId('')
                }}
              >
                <option value="">Todas</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{String(b.name || '').trim() || b.id}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Tipo</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={deviceTypeId}
                disabled={!brandId}
                onChange={(e) => {
                  setDeviceTypeId(e.target.value)
                  setDeviceModelId('')
                }}
              >
                <option value="">Todos</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{String(t.name || '').trim() || t.id}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Modelo</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={deviceModelId}
                disabled={!deviceTypeId}
                onChange={(e) => setDeviceModelId(e.target.value)}
              >
                <option value="">Todos</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{String(m.model || '').trim() || m.id}</option>
                ))}
              </select>
            </label>
            <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={() => void fetchPrices()} disabled={loadingRows}>
              {loadingRows ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card className="min-w-0 max-w-full border-muted">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Catálogo comercial</CardTitle>
          <CardDescription>
            Agrupado por tag de precificação e família. Somente leitura — sem custos nem cadastro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRows && rows.length === 0 ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : null}
          {!loadingRows && rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum item para os filtros atuais.</p>
          ) : null}
          {groups.length > 0 ? (
            <Accordion type="multiple" defaultValue={defaultAccordion} className="w-full">
              {groups.map((g) => (
                <AccordionItem key={g.key} value={g.key} className="border-b border-border/80">
                  <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline sm:text-base">
                    <span className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                      <span>{g.titleTag}</span>
                      <span className="text-xs font-normal text-muted-foreground sm:text-sm">{g.titleFamily}</span>
                      <span className="text-xs font-normal tabular-nums text-muted-foreground">({g.rows.length})</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-3 pb-2 pt-1 sm:grid-cols-2 xl:grid-cols-3">
                      {g.rows.map((r, idx) => (
                        <Card key={`${r.productId}-${idx}`} className="shadow-sm">
                          <CardHeader className="space-y-1 p-4 pb-2">
                            <CardTitle className="text-sm font-semibold leading-snug">{r.productName}</CardTitle>
                            <CardDescription className="text-xs">
                              {[r.brandName, r.deviceModelLabel].filter(Boolean).join(' · ') || '—'}
                              {r.productKind ? ` · ${r.productKind}` : ''}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="flex flex-wrap gap-4 p-4 pt-0 text-sm">
                            <div>
                              <div className="text-xs text-muted-foreground">Lista</div>
                              <div className="font-medium tabular-nums">{formatBrl(r.salePriceCents)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Sugerido</div>
                              <div className="font-medium tabular-nums text-primary">{formatBrl(r.suggestedSaleCents)}</div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
