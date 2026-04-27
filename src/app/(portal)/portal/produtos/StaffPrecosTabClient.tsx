'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Battery,
  Camera,
  Loader2,
  Monitor,
  Palette,
  Smartphone,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type DeviceCatalogRow = {
  id: string
  brand: string | null
  device_type: string | null
  model: string | null
}

type SelectedDevice = { id: string; label: string }

type PriceRow = {
  productId: string
  productName: string
  productKind: string
  salePriceCents: number | null
  vendaLojistaCents: number | null
  pricingTagName: string | null
}

type RetailerOption = { id: string; full_name: string | null; email: string | null }

function formatBrl (cents: number | null) {
  if (cents == null) return '—'
  const v = cents / 100
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function normalizeTagKey (value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function getTagVisual (tagName: string): { icon: LucideIcon; label: string } {
  const n = normalizeTagKey(tagName)
  if (n.includes('display')) return { icon: Monitor, label: 'Display' }
  if (n.includes('bateria')) return { icon: Battery, label: 'Bateria' }
  if (n.includes('troca de vidro') || n.includes('vidro')) return { icon: Wrench, label: 'Troca de vidro' }
  if (n.includes('tampa')) return { icon: Palette, label: 'Tampa' }
  if (n.includes('camera')) return { icon: Camera, label: 'Câmera' }
  return { icon: Smartphone, label: tagName || 'Sem tag' }
}

export function StaffPrecosTabClient () {
  const [deviceCatalog, setDeviceCatalog] = useState<DeviceCatalogRow[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [deviceQuery, setDeviceQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ value: string; label: string }[]>([])
  const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deviceInputRef = useRef<HTMLInputElement | null>(null)
  const pendingFocusSearchRef = useRef(false)

  const [selectedDevice, setSelectedDevice] = useState<SelectedDevice | null>(null)

  const [rows, setRows] = useState<PriceRow[]>([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [retailers, setRetailers] = useState<RetailerOption[]>([])
  const [retailersLoading, setRetailersLoading] = useState(true)
  const [retailerUserId, setRetailerUserId] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setRetailersLoading(true)
      const res = await fetch('/api/portal/staff/retailers')
      const json = await res.json().catch(() => null)
      if (cancelled || !res.ok || !json?.ok) {
        setRetailers([])
        setRetailersLoading(false)
        return
      }
      setRetailers((json.retailers || []) as RetailerOption[])
      setRetailersLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setCatalogLoading(true)
      const res = await fetch('/api/portal/device-models?limit=2000')
      const json = await res.json().catch(() => null)
      if (cancelled || !res.ok || !json?.ok) {
        setDeviceCatalog([])
        setCatalogLoading(false)
        return
      }
      setDeviceCatalog((json.deviceModels || []) as DeviceCatalogRow[])
      setCatalogLoading(false)
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
    const q = deviceQuery.trim().toLowerCase()
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    setSuggestions(deviceOptions.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 50))
  }, [deviceQuery, deviceOptions])

  useEffect(() => {
    if (!selectedDevice?.id) {
      setRows([])
      setLoadingRows(false)
      setError(null)
      return
    }

    let cancelled = false
    void (async () => {
      setLoadingRows(true)
      setError(null)
      const qs = new URLSearchParams()
      qs.set('deviceModelId', selectedDevice.id)
      if (retailerUserId) qs.set('retailerUserId', retailerUserId)
      const res = await fetch(`/api/portal/staff/tabela-precos?${qs.toString()}`)
      const json = await res.json().catch(() => null)
      if (cancelled) return
      setLoadingRows(false)
      if (!res.ok || !json?.ok) {
        setError('Não foi possível carregar a tabela de preços.')
        setRows([])
        return
      }
      const raw = (json.items || []) as Record<string, unknown>[]
      setRows(
        raw.map((r) => ({
          productId: String(r.productId),
          productName: String(r.productName),
          productKind: String(r.productKind),
          salePriceCents: typeof r.salePriceCents === 'number' ? r.salePriceCents : null,
          vendaLojistaCents: typeof r.vendaLojistaCents === 'number' ? r.vendaLojistaCents : null,
          pricingTagName: r.pricingTagName != null ? String(r.pricingTagName) : null,
        })),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [selectedDevice, retailerUserId])

  function handlePick (opt: { value: string; label: string }) {
    setSelectedDevice({ id: opt.value, label: opt.label })
    setDeviceQuery('')
    setSuggestions([])
  }

  function clearDevice () {
    pendingFocusSearchRef.current = false
    setSelectedDevice(null)
    setDeviceQuery('')
    setSuggestions([])
    setRows([])
    setError(null)
  }

  function beginEditDeviceSearch () {
    if (!selectedDevice) return
    pendingFocusSearchRef.current = true
    const label = selectedDevice.label
    setSelectedDevice(null)
    setDeviceQuery(label)
  }

  useLayoutEffect(() => {
    if (!pendingFocusSearchRef.current) return
    if (selectedDevice != null) return
    pendingFocusSearchRef.current = false
    const el = deviceInputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [selectedDevice])

  const groupedRows = useMemo(() => {
    const grouped = new Map<string, PriceRow[]>()
    for (const row of rows) {
      const key = (row.pricingTagName || 'Sem tag').trim() || 'Sem tag'
      const current = grouped.get(key) || []
      current.push(row)
      grouped.set(key, current)
    }

    return [...grouped.entries()]
      .map(([tagName, items]) => ({
        tagName,
        items: [...items].sort((a, b) => a.productName.localeCompare(b.productName, 'pt-BR')),
      }))
      .sort((a, b) => a.tagName.localeCompare(b.tagName, 'pt-BR'))
  }, [rows])

  return (
    <Card className="min-w-0 max-w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg">Tabela de preços (operacional)</CardTitle>
        <CardDescription>
          Selecione um dispositivo e, opcionalmente, um lojista para simular overrides. Exibição agrupada por tag.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {selectedDevice ? (
            <div className="space-y-2">
              <Label>Dispositivo</Label>
              <div className="flex min-h-10 items-center gap-2 rounded-md border border-primary/25 bg-primary/5 text-sm shadow-sm">
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-text truncate px-3 py-2 text-left font-medium text-foreground outline-none ring-offset-background hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={beginEditDeviceSearch}
                  title="Clique para editar a busca"
                >
                  {selectedDevice.label}
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearDevice()
                  }}
                  aria-label="Limpar dispositivo"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          ) : (
            <div className="relative space-y-2">
              <Label htmlFor="staff-precos-device">Selecionar dispositivo</Label>
              <div className="relative">
                <Input
                  ref={deviceInputRef}
                  id="staff-precos-device"
                  placeholder="Marca, tipo ou modelo (mín. 2 caracteres)…"
                  value={deviceQuery}
                  onChange={(e) => setDeviceQuery(e.target.value)}
                  onBlur={() => {
                    blurRef.current = setTimeout(() => setSuggestions([]), 150)
                  }}
                  onFocus={() => {
                    if (blurRef.current) {
                      clearTimeout(blurRef.current)
                      blurRef.current = null
                    }
                  }}
                  disabled={catalogLoading}
                  autoComplete="off"
                />
                {catalogLoading ? (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    Carregando…
                  </span>
                ) : null}
                {suggestions.length > 0 ? (
                  <ul className="absolute z-20 mt-1 max-h-52 w-full list-none overflow-auto rounded-md border bg-popover p-0 py-1 shadow-md">
                    {suggestions.map((opt) => (
                      <li key={opt.value}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handlePick(opt)}
                        >
                          {opt.label}
                        </button>
                      </li>
                    ))}
                    {suggestions.length === 50 ? (
                      <li className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                        Lista limitada a 50 itens — refine a busca.
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
              {!catalogLoading && deviceQuery.trim().length > 0 && deviceQuery.trim().length < 2 ? (
                <p className="text-xs text-muted-foreground">Mínimo 2 caracteres.</p>
              ) : null}
              {!catalogLoading && deviceQuery.trim().length >= 2 && suggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum modelo encontrado.</p>
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="staff-precos-retailer">Lojista</Label>
            <Select
              value={retailerUserId || '__none__'}
              onValueChange={(v) => setRetailerUserId(v === '__none__' ? '' : v)}
              disabled={retailersLoading}
            >
              <SelectTrigger id="staff-precos-retailer">
                <SelectValue placeholder={retailersLoading ? 'Carregando lojistas…' : 'Nenhum'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {retailers.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {[r.full_name, r.email].filter(Boolean).join(' · ') || r.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!selectedDevice ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Selecione um dispositivo para carregar a tabela.
          </p>
        ) : loadingRows ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden />
          </div>
        ) : groupedRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum item com tag e modelo para este aparelho.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {groupedRows.map((group) => {
              const visual = getTagVisual(group.tagName)
              const Icon = visual.icon
              return (
                <Card key={group.tagName} className="border-border/70">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="rounded-md border bg-muted/50 p-1.5">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <CardTitle className="truncate text-base">
                          {visual.label}
                        </CardTitle>
                      </div>
                      <Badge variant="secondary">
                        {group.items.length} opção{group.items.length === 1 ? '' : 'ões'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {group.items.map((item) => (
                      <div
                        key={item.productId}
                        className="rounded-md border bg-background px-3 py-2"
                      >
                        <p className="truncate text-sm font-medium">{item.productName}</p>
                        {item.productKind ? (
                          <p className="text-xs text-muted-foreground">{item.productKind}</p>
                        ) : null}
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">Venda</span>
                          <span className="font-medium tabular-nums">{formatBrl(item.salePriceCents)}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">Venda lojista</span>
                          <span className={item.vendaLojistaCents != null ? 'font-semibold tabular-nums text-primary' : 'tabular-nums text-muted-foreground'}>
                            {formatBrl(item.vendaLojistaCents)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
