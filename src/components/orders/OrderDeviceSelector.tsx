'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
}: OrderDeviceSelectorProps) {
  const [deviceModels, setDeviceModels] = useState<DeviceModel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newBrand, setNewBrand] = useState('')
  const [newDeviceType, setNewDeviceType] = useState('')
  const [newModel, setNewModel] = useState('')

  // Estado interno para modo form nativo
  const [internalBrand, setInternalBrand] = useState(initialValue?.brand ?? '')
  const [internalDeviceType, setInternalDeviceType] = useState(initialValue?.deviceType ?? '')
  const [internalDeviceModelId, setInternalDeviceModelId] = useState(initialValue?.deviceModelId ?? '')
  const [internalModel, setInternalModel] = useState(initialValue?.model ?? '')

  const isFormikMode = !!formik
  const brand = isFormikMode ? formik.values.brand : internalBrand
  const deviceType = isFormikMode ? formik.values.deviceType : internalDeviceType
  const deviceModelId = isFormikMode ? formik.values.deviceModelId : internalDeviceModelId

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

  async function handleCreateDevice() {
    setCreateError(null)
    if (!newBrand.trim() || !newDeviceType.trim() || !newModel.trim()) {
      setCreateError('Preencha marca, dispositivo e modelo.')
      return
    }
    setIsCreating(true)
    try {
      const res = await portalFetch('/api/portal/device-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: newBrand.trim(),
          deviceType: newDeviceType.trim(),
          model: newModel.trim(),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !data?.deviceModel?.id) {
        setCreateError('Não foi possível cadastrar o dispositivo.')
        return
      }
      const dm = data.deviceModel as DeviceModel
      setDeviceModels((prev) => {
        const exists = prev.some((p) => p.id === dm.id)
        if (exists) return prev
        return prev.concat(dm)
      })
      handleBrandChange(dm.brand)
      handleDeviceTypeChange(dm.device_type)
      handleModelChange(dm.id)
      setNewBrand('')
      setNewDeviceType('')
      setNewModel('')
      setIsCreateOpen(false)
    } catch {
      setCreateError('Não foi possível cadastrar o dispositivo.')
    } finally {
      setIsCreating(false)
    }
  }

  function openCreateDialog() {
    setCreateError(null)
    setNewBrand(brand)
    setNewDeviceType(deviceType)
    setNewModel('')
    setIsCreateOpen(true)
  }

  const isLoadingModels = isLoading || disabled

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Marca</Label>
          <select
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={brand}
            onChange={(e) => handleBrandChange(e.target.value)}
            disabled={isLoadingModels}
          >
            <option value="">Selecione…</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Dispositivo</Label>
          <select
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={deviceType}
            onChange={(e) => handleDeviceTypeChange(e.target.value)}
            disabled={!brand || isLoadingModels}
          >
            <option value="">Selecione…</option>
            {deviceTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Modelo</Label>
          <select
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={deviceModelId}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={!brand || !deviceType || isLoadingModels}
          >
            <option value="">Selecione…</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={openCreateDialog}
          disabled={isLoadingModels}
        >
          <Plus className="h-4 w-4 mr-2" />
          Cadastrar novo dispositivo
        </Button>
      </div>

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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar dispositivo</DialogTitle>
            <DialogDescription>
              Adicione um novo modelo ao catálogo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                  placeholder="Ex: Apple"
                />
              </div>
              <div className="space-y-2">
                <Label>Dispositivo</Label>
                <Input
                  value={newDeviceType}
                  onChange={(e) => setNewDeviceType(e.target.value)}
                  placeholder="Ex: smartphone"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                placeholder="Ex: iPhone 13"
              />
            </div>
            {createError ? (
              <p className="text-sm text-destructive">{createError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateDevice}
              disabled={isCreating}
            >
              {isCreating ? 'Salvando…' : 'Salvar dispositivo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
