'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { portalFetch } from '@/lib/portal/portal-fetch'

type DeviceModelRow = {
  id: string
  brand: string
  device_type: string
  model: string
  created_at?: string | null
}

function cleanText(value: string) {
  return String(value || '').trim()
}

export function AparelhosClient(props: { initialDeviceModels: DeviceModelRow[] }) {
  const [rows, setRows] = useState<DeviceModelRow[]>(props.initialDeviceModels || [])

  const [brand, setBrand] = useState('')
  const [deviceType, setDeviceType] = useState('')
  const [modelQuery, setModelQuery] = useState('')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [newBrand, setNewBrand] = useState('')
  const [newDeviceType, setNewDeviceType] = useState('')
  const [newModel, setNewModel] = useState('')

  const filtered = useMemo(() => {
    const brandQ = cleanText(brand).toLowerCase()
    const typeQ = cleanText(deviceType).toLowerCase()
    const modelQ = cleanText(modelQuery).toLowerCase()

    return rows.filter((r) => {
      if (brandQ && !String(r.brand || '').toLowerCase().includes(brandQ)) return false
      if (typeQ && !String(r.device_type || '').toLowerCase().includes(typeQ)) return false
      if (modelQ && !String(r.model || '').toLowerCase().includes(modelQ)) return false
      return true
    })
  }, [rows, brand, deviceType, modelQuery])

  const uniqueBrands = useMemo(() => {
    return Array.from(new Set(rows.map(r => String(r.brand || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(rows.map(r => String(r.device_type || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [rows])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (isSaving) return

    setErrorMessage('')
    const payload = {
      brand: cleanText(newBrand),
      deviceType: cleanText(newDeviceType),
      model: cleanText(newModel),
    }

    if (!payload.brand || !payload.deviceType || !payload.model) {
      setErrorMessage('Preencha marca, dispositivo e modelo.')
      return
    }

    setIsSaving(true)
    try {
      const res = await portalFetch('/api/portal/device-models', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        setErrorMessage('Não foi possível cadastrar. Tente novamente.')
        return
      }

      const deviceModel = json.deviceModel as { id: string, brand: string, device_type?: string, deviceType?: string, model: string } | undefined
      if (!deviceModel?.id) {
        setErrorMessage('Não foi possível cadastrar. Tente novamente.')
        return
      }

      const normalizedRow: DeviceModelRow = {
        id: deviceModel.id,
        brand: String(deviceModel.brand || payload.brand),
        device_type: String(deviceModel.device_type || deviceModel.deviceType || payload.deviceType),
        model: String(deviceModel.model || payload.model),
        created_at: null,
      }

      setRows((prev) => {
        const exists = prev.some((r) => r.id === normalizedRow.id)
        if (exists) return prev
        return prev
          .concat(normalizedRow)
          .sort((a, b) => {
            const ab = a.brand.localeCompare(b.brand)
            if (ab !== 0) return ab
            const at = a.device_type.localeCompare(b.device_type)
            if (at !== 0) return at
            return a.model.localeCompare(b.model)
          })
      })

      setIsCreateOpen(false)
      setNewBrand('')
      setNewDeviceType('')
      setNewModel('')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Aparelhos</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre e gerencie marca, dispositivo e modelo.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setErrorMessage('')
            setIsCreateOpen(true)
          }}
        >
          Cadastrar aparelho
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar</CardTitle>
          <CardDescription>
            Filtre por marca, dispositivo (tipo) ou modelo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ex: Apple, Samsung"
                list="brands-list"
              />
              <datalist id="brands-list">
                {uniqueBrands.map((b) => <option key={b} value={b} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deviceType">Dispositivo</Label>
              <Input
                id="deviceType"
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value)}
                placeholder="Ex: Smartphone, iPad"
                list="types-list"
              />
              <datalist id="types-list">
                {uniqueTypes.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input
                id="model"
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                placeholder="Ex: iPhone 13, Galaxy S23"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className="text-sm text-muted-foreground">
              {filtered.length} de {rows.length} itens
            </div>
            <div className="flex-1" />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBrand('')
                setDeviceType('')
                setModelQuery('')
              }}
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modelos cadastrados</CardTitle>
          <CardDescription>
            Lista ordenada por marca, dispositivo e modelo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Modelo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.brand}</TableCell>
                    <TableCell>{r.device_type}</TableCell>
                    <TableCell>{r.model}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-sm text-muted-foreground">
              Nenhum item encontrado.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar aparelho</DialogTitle>
            <DialogDescription>
              Informe marca, dispositivo e modelo.
            </DialogDescription>
          </DialogHeader>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Não foi possível salvar</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleCreate} className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="newBrand">Marca</Label>
              <Input
                id="newBrand"
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                placeholder="Ex: Apple"
                autoFocus
                list="brands-list"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newDeviceType">Dispositivo</Label>
              <Input
                id="newDeviceType"
                value={newDeviceType}
                onChange={(e) => setNewDeviceType(e.target.value)}
                placeholder="Ex: Smartphone"
                list="types-list"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newModel">Modelo</Label>
              <Input
                id="newModel"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                placeholder="Ex: iPhone 13"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

