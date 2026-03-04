'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, ChevronsUpDown, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { portalFetch } from '@/lib/portal/portal-fetch'

export type DeviceModel = {
  id: string
  brand: string
  device_type: string
  model: string
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

type FormikValues = {
  brand: string
  deviceType: string
  deviceModelId: string
  model: string
}

type FormikProps = {
  values: FormikValues
  setFieldValue: (field: string, value: string) => void
}

type OrderDeviceSelectorProps = {
  /** Modo Formik: usa values e setFieldValue do formulário. */
  formik?: FormikProps
  /** Modo form nativo: valores iniciais e inputs hidden. */
  initialValue?: {
    deviceModelId?: string | null
    brand?: string | null
    deviceType?: string | null
    model?: string | null
  }
  /** Nomes dos inputs hidden. Usado quando initialValue está definido. */
  inputNames?: {
    deviceModelId?: string
    brand?: string
    deviceType?: string
    model?: string
  }
  /** Id do form para associar inputs. */
  formId?: string
  /** Desabilita o componente (ex: durante loading). */
  disabled?: boolean
  /** Se há aparelhos já cadastrados (ex.: do cliente atual). */
  hasExistingDevices?: boolean
  /** Abre seleção de aparelhos já cadastrados. */
  onOpenExistingDevices?: () => void
}

export function OrderDeviceSelector({
  formik,
  initialValue,
  inputNames = {
    deviceModelId: 'deviceModelId',
    brand: 'brand',
    deviceType: 'deviceType',
    model: 'model',
  },
  formId,
  disabled = false,
  hasExistingDevices = false,
  onOpenExistingDevices,
}: OrderDeviceSelectorProps) {
  const [deviceModels, setDeviceModels] = useState<DeviceModel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [brandSearch, setBrandSearch] = useState('')
  const [deviceTypeSearch, setDeviceTypeSearch] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [brandOpen, setBrandOpen] = useState(false)
  const [deviceTypeOpen, setDeviceTypeOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)

  // Estado interno para modo form nativo
  const [internalBrand, setInternalBrand] = useState(initialValue?.brand ?? '')
  const [internalDeviceType, setInternalDeviceType] = useState(initialValue?.deviceType ?? '')
  const [internalDeviceModelId, setInternalDeviceModelId] = useState(initialValue?.deviceModelId ?? '')
  const [internalModel, setInternalModel] = useState(initialValue?.model ?? '')

  const isFormikMode = !!formik
  const brand = isFormikMode ? formik.values.brand : internalBrand
  const deviceType = isFormikMode ? formik.values.deviceType : internalDeviceType
  const deviceModelId = isFormikMode ? formik.values.deviceModelId : internalDeviceModelId
  const model = isFormikMode ? formik.values.model : internalModel

  const brands = useMemo(
    () => uniqueSorted(deviceModels.map((d) => d.brand)),
    [deviceModels]
  )
  const deviceTypes = useMemo(
    () =>
      !brand
        ? []
        : uniqueSorted(
          deviceModels.filter((d) => d.brand === brand).map((d) => d.device_type)
        ),
    [deviceModels, brand]
  )
  const models = useMemo(
    () =>
      !brand || !deviceType
        ? []
        : deviceModels.filter(
          (d) => d.brand === brand && d.device_type === deviceType
        ),
    [deviceModels, brand, deviceType]
  )

  useEffect(() => {
    let cancelled = false
    async function fetchModels() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await portalFetch('/api/portal/device-models?limit=2000')
        const data = await res.json().catch(() => null)
        if (!cancelled && data?.deviceModels) {
          setDeviceModels(data.deviceModels)
        }
      } catch {
        if (!cancelled) setError('Não foi possível carregar os dispositivos.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    fetchModels()
    return () => {
      cancelled = true
    }
  }, [])

  function handleBrandChange(value: string) {
    if (isFormikMode) {
      formik!.setFieldValue('brand', value)
      formik!.setFieldValue('deviceType', '')
      formik!.setFieldValue('deviceModelId', '')
      formik!.setFieldValue('model', '')
    } else {
      setInternalBrand(value)
      setInternalDeviceType('')
      setInternalDeviceModelId('')
      setInternalModel('')
    }
  }

  function handleDeviceTypeChange(value: string) {
    if (isFormikMode) {
      formik!.setFieldValue('deviceType', value)
      formik!.setFieldValue('deviceModelId', '')
      formik!.setFieldValue('model', '')
    } else {
      setInternalDeviceType(value)
      setInternalDeviceModelId('')
      setInternalModel('')
    }
  }

  function handleModelChange(id: string) {
    const m = deviceModels.find((d) => d.id === id)
    if (isFormikMode) {
      formik!.setFieldValue('deviceModelId', id)
      formik!.setFieldValue('model', m?.model ?? '')
    } else {
      setInternalDeviceModelId(id)
      setInternalModel(m?.model ?? '')
    }
  }

  async function handleCreateDevice(brandNameRaw: string, deviceTypeNameRaw: string, modelNameRaw: string) {
    const brandName = brandNameRaw.trim()
    const deviceTypeName = deviceTypeNameRaw.trim()
    const modelName = modelNameRaw.trim()
    if (!brandName || !deviceTypeName || !modelName) {
      setError('Preencha marca, dispositivo e modelo.')
      return
    }
    setError(null)
    try {
      // 1) Garante a marca (cria ou reutiliza existente)
      const brandRes = await portalFetch('/api/portal/device-brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: brandName }),
      })
      const brandData = await brandRes?.json().catch(() => null)
      const brandRow = brandData?.deviceBrand as { id: string; name: string } | undefined
      if (!brandRes?.ok || !brandData?.ok || !brandRow?.id) {
        setError('Não foi possível cadastrar a marca.')
        return
      }

      // 2) Garante o dispositivo (cria ou reutiliza associado à marca)
      const typeRes = await portalFetch('/api/portal/device-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: brandRow.id, name: deviceTypeName }),
      })
      const typeData = await typeRes?.json().catch(() => null)
      const typeRow = typeData?.deviceType as { id: string; name: string } | undefined
      if (!typeRes?.ok || !typeData?.ok || !typeRow?.id) {
        setError('Não foi possível cadastrar o dispositivo.')
        return
      }

      // 3) Cria o modelo (aparelho) vinculado ao dispositivo
      const modelRes = await portalFetch('/api/portal/device-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_type_id: typeRow.id, model: modelName }),
      })
      const modelData = await modelRes?.json().catch(() => null)
      const rawDeviceModel = modelData?.deviceModel as {
        id: string
        model: string
        brand?: string | null
        device_type?: string | null
      } | undefined
      if (!modelRes?.ok || !modelData?.ok || !rawDeviceModel?.id) {
        setError('Não foi possível cadastrar o aparelho.')
        return
      }

      const dm: DeviceModel = {
        id: rawDeviceModel.id,
        model: rawDeviceModel.model,
        brand: rawDeviceModel.brand || brandRow.name,
        device_type: rawDeviceModel.device_type || typeRow.name,
      }

      setDeviceModels((prev) => {
        const exists = prev.some((p) => p.id === dm.id)
        if (exists) return prev
        return prev.concat(dm)
      })
      handleBrandChange(dm.brand)
      handleDeviceTypeChange(dm.device_type)
      handleModelChange(dm.id)
    } catch {
      setError('Não foi possível cadastrar o aparelho.')
    }
  }

  const isLoadingModels = isLoading || disabled

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {hasExistingDevices && onOpenExistingDevices ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onOpenExistingDevices}
            disabled={isLoadingModels}
            aria-label="Selecionar aparelho já cadastrado"
            className="h-8 w-8"
          >
            <History className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
            <Label htmlFor="deviceBrand">Marca</Label>
          <Popover open={brandOpen} onOpenChange={setBrandOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  id="deviceBrand"
                  disabled={isLoadingModels}
                  className="w-full inline-flex items-center justify-between rounded-md border border-input bg-background px-3 py-2.5 text-sm hover:bg-accent/40 disabled:cursor-not-allowed"
                >
                  <span className={!brand ? 'text-muted-foreground' : ''}>
                    {brand || 'Selecione…'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[260px]" align="start">
                <Command>
                  <CommandInput
                    placeholder="Filtrar marca..."
                    value={brandSearch}
                    onValueChange={(value) => setBrandSearch(value)}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhuma marca encontrada.</CommandEmpty>
                    <CommandGroup>
                      {brands.map((b) => (
                        <CommandItem
                          key={b}
                          value={b}
                          onSelect={(value) => {
                            setBrandSearch(value)
                            handleBrandChange(value)
                            setBrandOpen(false)
                          }}
                        >
                          {b}
                        </CommandItem>
                      ))}
                      {brandSearch.trim() && !brands.some((b) => b.toLowerCase() === brandSearch.trim().toLowerCase()) ? (
                        <CommandItem
                          value={brandSearch.trim()}
                          onSelect={async () => {
                            const name = brandSearch.trim()
                            setBrandSearch('')
                            try {
                              await portalFetch('/api/portal/device-brands', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name }),
                              })
                            } catch {
                              // erro silencioso; usuário pode tentar novamente
                            }
                            handleBrandChange(name)
                            setBrandOpen(false)
                          }}
                        >
                          Criar &quot;{brandSearch.trim()}&quot; como nova marca
                        </CommandItem>
                      ) : null}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        <div className="space-y-2">
            <Label htmlFor="deviceType">Dispositivo</Label>
          <Popover open={deviceTypeOpen} onOpenChange={setDeviceTypeOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  id="deviceType"
                  disabled={!brand || isLoadingModels}
                  className="w-full inline-flex items-center justify-between rounded-md border border-input bg-background px-3 py-2.5 text-sm hover:bg-accent/40 disabled:cursor-not-allowed"
                >
                  <span className={!deviceType ? 'text-muted-foreground' : ''}>
                    {deviceType || 'Selecione…'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[260px]" align="start">
                <Command>
                  <CommandInput
                    placeholder="Filtrar dispositivo..."
                    value={deviceTypeSearch}
                    onValueChange={(value) => setDeviceTypeSearch(value)}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum dispositivo encontrado.</CommandEmpty>
                    <CommandGroup>
                      {deviceTypes.map((t) => (
                        <CommandItem
                          key={t}
                          value={t}
                          onSelect={(value) => {
                            setDeviceTypeSearch(value)
                            handleDeviceTypeChange(value)
                            setDeviceTypeOpen(false)
                          }}
                        >
                          {t}
                        </CommandItem>
                      ))}
                      {deviceTypeSearch.trim() && brand && !deviceTypes.some((t) => t.toLowerCase() === deviceTypeSearch.trim().toLowerCase()) ? (
                        <CommandItem
                          value={deviceTypeSearch.trim()}
                          onSelect={async () => {
                            const name = deviceTypeSearch.trim()
                            setDeviceTypeSearch('')
                            try {
                              // garante que a marca exista e obtem id
                              const brandRes = await portalFetch('/api/portal/device-brands', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: brand }),
                              })
                              const brandData = await brandRes?.json().catch(() => null)
                              const brandRow = brandData?.deviceBrand as { id: string } | undefined
                              if (brandRes?.ok && brandData?.ok && brandRow?.id) {
                                await portalFetch('/api/portal/device-types', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ brandId: brandRow.id, name }),
                                })
                              }
                            } catch {
                              // erro silencioso
                            }
                            handleDeviceTypeChange(name)
                            setDeviceTypeOpen(false)
                          }}
                        >
                          Criar &quot;{deviceTypeSearch.trim()}&quot; como novo dispositivo
                        </CommandItem>
                      ) : null}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        <div className="space-y-2">
            <Label htmlFor="deviceModel">Modelo</Label>
          <Popover open={modelOpen} onOpenChange={setModelOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  id="deviceModel"
                  disabled={!brand || !deviceType || isLoadingModels}
                  className="w-full inline-flex items-center justify-between rounded-md border border-input bg-background px-3 py-2.5 text-sm hover:bg-accent/40 disabled:cursor-not-allowed"
                >
                  <span className={!deviceModelId ? 'text-muted-foreground' : ''}>
                    {models.find((m) => m.id === deviceModelId)?.model || 'Selecione…'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[260px]" align="start">
                <Command>
                  <CommandInput
                    placeholder="Filtrar modelo..."
                    value={modelSearch}
                    onValueChange={(value) => setModelSearch(value)}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
                    <CommandGroup>
                      {models.map((m) => (
                        <CommandItem
                          key={m.id}
                          value={m.model}
                          onSelect={() => {
                            setModelSearch(m.model)
                            handleModelChange(m.id)
                            setModelOpen(false)
                          }}
                        >
                          <span className="text-sm">{m.model}</span>
                        </CommandItem>
                      ))}
                      {modelSearch.trim() && brand && deviceType && !models.some((m) => m.model.toLowerCase() === modelSearch.trim().toLowerCase())
                        ? (
                          <CommandItem
                            value={modelSearch.trim()}
                            onSelect={() => {
                              setModelSearch('')
                              // criação encadeada: marca, dispositivo e modelo
                              void handleCreateDevice(brand, deviceType, modelSearch.trim())
                              setModelOpen(false)
                            }}
                          >
                            <span className="text-sm">Criar &quot;{modelSearch.trim()}&quot; como novo modelo</span>
                          </CommandItem>
                        )
                        : null}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {!isFormikMode && inputNames ? (
        <>
          <input
            type="hidden"
            name={inputNames.deviceModelId}
            value={deviceModelId}
            form={formId}
            readOnly
            aria-hidden
          />
          <input
            type="hidden"
            name={inputNames.brand}
            value={brand}
            form={formId}
            readOnly
            aria-hidden
          />
          <input
            type="hidden"
            name={inputNames.deviceType}
            value={deviceType}
            form={formId}
            readOnly
            aria-hidden
          />
          <input
            type="hidden"
            name={inputNames.model}
            value={internalModel}
            form={formId}
            readOnly
            aria-hidden
          />
        </>
      ) : null}
    </div>
  )
}
