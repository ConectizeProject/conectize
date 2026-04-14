'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type DeviceBrand = { id: string; name: string | null }
type DeviceType = { id: string; name: string | null }
type DeviceModel = { id: string; model: string | null }

type PriceRow = {
  productId: string
  productName: string
  productKind: string
  sku: string | null
  salePriceCents: number | null
  costPriceCents: number | null
  suggestedSaleCents: number | null
  pricingTagName: string | null
  partsFamily: string | null
  deviceModelLabel: string | null
  brandName: string | null
}

function formatBrl (cents: number | null) {
  if (cents == null) return '—'
  const v = cents / 100
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function StaffPrecosTabClient () {
  const [brands, setBrands] = useState<DeviceBrand[]>([])
  const [types, setTypes] = useState<DeviceType[]>([])
  const [models, setModels] = useState<DeviceModel[]>([])
  const [brandId, setBrandId] = useState('')
  const [deviceTypeId, setDeviceTypeId] = useState('')
  const [deviceModelId, setDeviceModelId] = useState('')
  const [rows, setRows] = useState<PriceRow[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingMeta(true)
      setError(null)
      const res = await fetch('/api/portal/device-brands')
      const json = await res.json().catch(() => null)
      if (cancelled) return
      if (!res.ok || !json?.ok) {
        setError('Não foi possível carregar marcas.')
        setBrands([])
      } else {
        setBrands((json.deviceBrands || []) as DeviceBrand[])
      }
      setLoadingMeta(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadTypes = useCallback(async (bid: string) => {
    if (!bid) {
      setTypes([])
      return
    }
    const res = await fetch(`/api/portal/device-types?brandId=${encodeURIComponent(bid)}`)
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) {
      setTypes([])
      return
    }
    setTypes((json.deviceTypes || []) as DeviceType[])
  }, [])

  const loadModels = useCallback(async (tid: string) => {
    if (!tid) {
      setModels([])
      return
    }
    const res = await fetch(`/api/portal/device-models?deviceTypeId=${encodeURIComponent(tid)}&limit=2000`)
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) {
      setModels([])
      return
    }
    setModels((json.deviceModels || []) as DeviceModel[])
  }, [])

  useEffect(() => {
    if (!brandId) {
      setTypes([])
      setDeviceTypeId('')
      setModels([])
      setDeviceModelId('')
      return
    }
    void loadTypes(brandId)
  }, [brandId, loadTypes])

  useEffect(() => {
    if (!deviceTypeId) {
      setModels([])
      setDeviceModelId('')
      return
    }
    void loadModels(deviceTypeId)
  }, [deviceTypeId, loadModels])

  const fetchPrices = useCallback(async () => {
    setLoadingRows(true)
    setError(null)
    const qs = new URLSearchParams()
    if (brandId) qs.set('brandId', brandId)
    if (deviceTypeId) qs.set('deviceTypeId', deviceTypeId)
    if (deviceModelId) qs.set('deviceModelId', deviceModelId)
    const res = await fetch(`/api/portal/staff/tabela-precos?${qs.toString()}`)
    const json = await res.json().catch(() => null)
    setLoadingRows(false)
    if (!res.ok || !json?.ok) {
      setError('Não foi possível carregar a tabela de preços.')
      setRows([])
      return
    }
    setRows((json.items || []) as PriceRow[])
  }, [brandId, deviceTypeId, deviceModelId])

  useEffect(() => {
    void fetchPrices()
  }, [fetchPrices])

  return (
    <Card className="min-w-0 max-w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg">Tabela de preços (operacional)</CardTitle>
        <CardDescription>
          Preço de lista, custo e sugerido ao consumidor (regras de tag; staff não aplica override de lojista nesta visão).
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

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Marca / modelo</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Venda</TableHead>
                <TableHead className="text-right">Sugerido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && !loadingRows ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nenhuma linha para os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : null}
              {rows.map((r, idx) => (
                <TableRow key={`${r.productId}-${idx}`}>
                  <TableCell className="max-w-[14rem] truncate font-medium">{r.productName}</TableCell>
                  <TableCell className="text-muted-foreground">{r.sku || '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {[r.brandName, r.deviceModelLabel].filter(Boolean).join(' · ') || '—'}
                  </TableCell>
                  <TableCell className="text-sm">{r.pricingTagName || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBrl(r.costPriceCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBrl(r.salePriceCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBrl(r.suggestedSaleCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
