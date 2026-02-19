'use client'

import { useState } from 'react'
import { useFormik } from 'formik'
import { brands, services } from '@/lib/data/services'
import { formatModelName } from '@/lib/utils/format-model-name'
import { Loader2 } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function getBrandOptions() {
  return Object.values(brands).slice()
}

function getServiceOptions() {
  return services.slice()
}

function getDeviceTypeOptions(brandSlug: string, serviceSlug?: string) {
  const brand = brands[brandSlug]
  if (!brand) return []

  const service = serviceSlug ? services.find(s => s.slug === serviceSlug) : undefined
  const excludedTypes = service?.excludedDeviceTypes?.[brandSlug] || []

  return Object.values(brand.deviceTypes)
    .filter(deviceType => !excludedTypes.includes(deviceType.slug))
    .slice()
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

function getModelOptions(brandSlug: string, serviceSlug?: string, deviceTypeSlug?: string) {
  const brand = brands[brandSlug]
  if (!brand) return []

  const service = serviceSlug ? services.find(s => s.slug === serviceSlug) : undefined
  const excludedTypes = service?.excludedDeviceTypes?.[brandSlug] || []

  const seen = new Set<string>()
  const models: Array<{ slug: string; label: string }> = []

  for (const deviceType of Object.values(brand.deviceTypes)) {
    if (excludedTypes.includes(deviceType.slug)) continue
    if (deviceTypeSlug && deviceType.slug !== deviceTypeSlug) continue
    for (const modelSlug of deviceType.models) {
      if (seen.has(modelSlug)) continue
      seen.add(modelSlug)
      models.push({ slug: modelSlug, label: formatModelName(modelSlug) })
    }
  }

  models.sort((a, b) => a.label.localeCompare(b.label))

  return models
}

export function ServicesFilters() {
  const router = useRouter()
  const pathname = usePathname() || '/servicos'
  const searchParams = useSearchParams()

  const marca = searchParams.get('marca') || ''
  const servico = searchParams.get('servico') || ''
  const dispositivo = searchParams.get('dispositivo') || ''
  const modelo = searchParams.get('modelo') || ''

  const [isApplying, setIsApplying] = useState(false)

  const brandOptions = getBrandOptions()
  const serviceOptions = getServiceOptions()
  const deviceTypeOptions = marca ? getDeviceTypeOptions(marca, servico || undefined) : []
  const modelOptions = marca ? getModelOptions(marca, servico || undefined, dispositivo || undefined) : []

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      marca: marca || '',
      servico: servico || '',
      dispositivo: dispositivo || '',
      modelo: modelo || ''
    },
    onSubmit: () => { }
  })

  const hasAnyFilterActive = Boolean(
    formik.values.marca ||
    formik.values.servico ||
    formik.values.dispositivo ||
    formik.values.modelo
  )

  const withApplying = async (fn: () => Promise<void>) => {
    const startAt = Date.now()
    setIsApplying(true)
    try {
      await fn()
    } finally {
      const elapsedMs = Date.now() - startAt
      const remainingMs = Math.max(0, 1000 - elapsedMs)
      if (remainingMs > 0) await new Promise(resolve => setTimeout(resolve, remainingMs))
      setIsApplying(false)
    }
  }

  const buildHref = (input: { marca?: string; servico?: string; dispositivo?: string; modelo?: string }) => {
    const params = new URLSearchParams()
    if (input.marca) params.set('marca', input.marca)
    if (input.servico) params.set('servico', input.servico)
    if (input.dispositivo) params.set('dispositivo', input.dispositivo)
    if (input.modelo) params.set('modelo', input.modelo)
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  const applyBrand = async (value: string) => {
    await withApplying(async () => {
      const nextValues = {
        ...formik.values,
        marca: value,
        dispositivo: '',
        modelo: ''
      }

      formik.setValues(nextValues)
      router.push(buildHref(nextValues))
    })
  }

  const applyService = async (value: string) => {
    await withApplying(async () => {
      const nextValues = {
        ...formik.values,
        servico: value,
        dispositivo: '',
        modelo: ''
      }

      formik.setValues(nextValues)
      router.push(buildHref(nextValues))
    })
  }

  const applyDeviceType = async (value: string) => {
    await withApplying(async () => {
      const nextValues = {
        ...formik.values,
        dispositivo: value,
        modelo: ''
      }

      formik.setValues(nextValues)
      router.push(buildHref(nextValues))
    })
  }

  const applyModel = async (value: string) => {
    await withApplying(async () => {
      const nextValues = {
        ...formik.values,
        modelo: value
      }

      formik.setValues(nextValues)
      router.push(buildHref(nextValues))
    })
  }

  const handleClear = async () => {
    await withApplying(async () => {
      const emptyValues = {
        marca: '',
        servico: '',
        dispositivo: '',
        modelo: ''
      }

      // zera imediatamente o Select (não depende do reinitialize via URL)
      formik.resetForm({ values: emptyValues })
      router.push(pathname)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Filtros</span>
          {isApplying && (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Aplicando...
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="filterMarca">Marca</Label>
          <Select value={formik.values.marca} onValueChange={applyBrand} disabled={isApplying}>
            <SelectTrigger id="filterMarca">
              <SelectValue placeholder="Selecione uma marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ignore__" disabled>
                Selecione a marca
              </SelectItem>
              {brandOptions.map((brand) => (
                <SelectItem key={brand.slug} value={brand.slug}>
                  {brand.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filterServico">Serviço</Label>
          <Select value={formik.values.servico} onValueChange={(value) => value === '__all__' ? applyService('') : applyService(value)} disabled={isApplying}>
            <SelectTrigger id="filterServico">
              <SelectValue placeholder="Selecione um serviço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">
                Selecione o serviço
              </SelectItem>
              {serviceOptions.map((service) => (
                <SelectItem key={service.slug} value={service.slug}>
                  {service.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filterDispositivo">Dispositivo</Label>
          <Select
            value={formik.values.dispositivo}
            disabled={isApplying}
            onValueChange={(value) => value === '__all__' ? applyDeviceType('') : applyDeviceType(value)}
          >
            <SelectTrigger id="filterDispositivo">
              <SelectValue placeholder="Selecione um dispositivo" />
            </SelectTrigger>
            <SelectContent>
              {!marca
                ? (
                  <SelectItem value="__ignore__" disabled>
                    Selecione uma marca
                  </SelectItem>
                )
                : (
                  <>
                    <SelectItem value="__all__">Todos os dispositivos</SelectItem>
                    {deviceTypeOptions.map((dt) => (
                      <SelectItem key={dt.slug} value={dt.slug}>
                        {dt.displayName}
                      </SelectItem>
                    ))}
                  </>
                )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filterModelo">Modelo</Label>
          <Select
            value={formik.values.modelo}
            disabled={isApplying}
            onValueChange={(value) => {
              if (value === '__all__') return applyModel('')
              return applyModel(value)
            }}
          >
            <SelectTrigger id="filterModelo">
              <SelectValue placeholder="Selecione o modelo do dispositivo" />
            </SelectTrigger>
            <SelectContent>
              {!marca
                ? (
                  <SelectItem value="__ignore__" disabled>
                    Selecione uma marca
                  </SelectItem>
                )
                : (
                  <>
                    <SelectItem value="__all__">Todos os modelos</SelectItem>
                    {modelOptions.map((m) => (
                      <SelectItem key={m.slug} value={m.slug}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </>
                )}
            </SelectContent>
          </Select>
        </div>

        {hasAnyFilterActive && (
          <Button variant="outline" className="w-full" onClick={handleClear} disabled={isApplying}>
            Limpar filtros
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

