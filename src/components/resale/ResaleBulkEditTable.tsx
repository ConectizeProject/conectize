'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import { ResaleDeviceQuickActionsDropdown } from '@/components/resale/ResaleDeviceQuickActionsDropdown'

export type ResaleBulkEditDevice = {
  id: string
  device_name: string | null
  model: string | null
  color: string | null
  storage_gb: string | null
  battery: string | null
  condition: string | null
  info: string | null
  imei: string | null
  purchase_value_cents: number | null
  wholesale_value_cents: number | null
  sale_value_cents: number | null
  sold_for_cents: number | null
  purchase_date: string | null
  sale_date: string | null
  sold: boolean
  stock_type?: string | null
  costs: Array<{ id: string; description: string | null; value_cents: number }>
}

type Props = {
  devices: ResaleBulkEditDevice[]
  onCancel: () => void
  onSaved: () => void
  onEdit: (device: ResaleBulkEditDevice) => void
  onMarkSold: (device: ResaleBulkEditDevice) => void
  onAddCost: (device: ResaleBulkEditDevice) => void
  onDelete: (device: ResaleBulkEditDevice) => void
  onSimulate: (device: ResaleBulkEditDevice) => void
  onPrintLabel: (device: ResaleBulkEditDevice) => void
  onCopyLojista: (device: ResaleBulkEditDevice) => void
  onCopyCliente: (device: ResaleBulkEditDevice) => void
  onCopyImei: (device: ResaleBulkEditDevice) => void
}

const EDITABLE_FIELDS: (keyof ResaleBulkEditDevice)[] = [
  'device_name',
  'color',
  'storage_gb',
  'battery',
  'condition',
  'info',
  'imei',
  'purchase_date',
  'sale_date',
  'wholesale_value_cents',
  'sale_value_cents',
  'sold_for_cents',
  'purchase_value_cents',
]

function centsToReais (cents: number | null | undefined): string {
  if (cents == null) return ''
  return maskedFromCents(cents)
}

function getChangedUpdates (
  original: ResaleBulkEditDevice[],
  edited: ResaleBulkEditDevice[],
): Array<{ id: string } & Record<string, unknown>> {
  const originalMap = new Map(original.map((d) => [d.id, d]))
  const updates: Array<{ id: string } & Record<string, unknown>> = []
  for (const row of edited) {
    const orig = originalMap.get(row.id)
    if (!orig) continue
    const changed: Record<string, unknown> = {}
    for (const key of EDITABLE_FIELDS) {
      const v = row[key]
      const o = orig[key]
      if (
        v !== o &&
        (v != null || o != null) &&
        String(v ?? '') !== String(o ?? '')
      ) {
        changed[key] = v
      }
    }
    if (row.stock_type === 'lacrado') {
      const hadWear =
        Boolean(String(orig.battery ?? '').trim()) ||
        Boolean(String(orig.condition ?? '').trim())
      const editedWear =
        Boolean(String(row.battery ?? '').trim()) ||
        Boolean(String(row.condition ?? '').trim())
      if (hadWear || editedWear) {
        changed.battery = null
        changed.condition = null
      }
    }
    if (Object.keys(changed).length > 0) {
      updates.push({ id: row.id, ...changed })
    }
  }
  return updates
}

export function ResaleBulkEditTable ({
  devices,
  onCancel,
  onSaved,
  onEdit,
  onMarkSold,
  onAddCost,
  onDelete,
  onSimulate,
  onPrintLabel,
  onCopyLojista,
  onCopyCliente,
  onCopyImei,
}: Props) {
  const router = useRouter()
  const [editedDevices, setEditedDevices] = useState<ResaleBulkEditDevice[]>(devices)
  const [isSaving, setIsSaving] = useState(false)
  const [showPurchaseValue, setShowPurchaseValue] = useState(true)
  const [showWholesaleValue, setShowWholesaleValue] = useState(true)

  useEffect(() => {
    setEditedDevices(devices)
  }, [devices])

  function updateRow<K extends keyof ResaleBulkEditDevice> (
    id: string,
    field: K,
    value: ResaleBulkEditDevice[K],
  ) {
    setEditedDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
    )
  }

  function updateMoney<K extends keyof ResaleBulkEditDevice> (
    id: string,
    field: K,
    raw: string,
  ) {
    const cents = moneyToCentsFromMasked(formatMoneyInput(raw))
    setEditedDevices((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, [field]: (cents ?? null) as ResaleBulkEditDevice[K] } : d,
      ),
    )
  }

  const handleSave = useCallback(async () => {
    if (isSaving) return
    const updates = getChangedUpdates(devices, editedDevices)
    if (updates.length === 0) {
      onSaved()
      return
    }
    setIsSaving(true)
    try {
      const res = await portalFetch('/api/portal/resale-devices/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        toast({ description: 'Alterações salvas', duration: 2000 })
        router.refresh()
        onSaved()
        return
      }
      if (data?.error === 'partial_failure') {
        toast({
          title: 'Algumas alterações falharam',
          description: 'Recarregue a lista e tente novamente nos itens que não salvaram.',
          variant: 'destructive',
        })
        router.refresh()
        onSaved()
        return
      }
      toast({
        title: 'Não foi possível salvar',
        description: data?.error || data?.message,
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }, [devices, editedDevices, isSaving, onSaved, router])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancelar
        </Button>
        <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
          {isSaving ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[11%]" />
            <col className="w-[14%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[4%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>Aparelho</TableHead>
              <TableHead>IMEI</TableHead>
              <TableHead>Informações</TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-1.5">
                  Valor compra
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowPurchaseValue((v) => !v)}
                    title={showPurchaseValue ? 'Ocultar valor de compra' : 'Exibir valor de compra'}
                    aria-label={showPurchaseValue ? 'Ocultar valor de compra' : 'Exibir valor de compra'}
                  >
                    {showPurchaseValue ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </span>
              </TableHead>
              <TableHead>Custos</TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-1.5">
                  Valores
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowWholesaleValue((v) => !v)}
                    title={showWholesaleValue ? 'Ocultar valor de atacado' : 'Exibir valor de atacado'}
                    aria-label={showWholesaleValue ? 'Ocultar valor de atacado' : 'Exibir valor de atacado'}
                  >
                    {showWholesaleValue ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </span>
              </TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editedDevices.map((d) => {
              const totalCostsCents = (d.costs || []).reduce(
                (acc, c) => acc + (c.value_cents ?? 0),
                0,
              )
              const isNovoRow = d.stock_type === 'lacrado'
              return (
                <TableRow key={d.id} className={d.sold ? 'bg-muted/60' : ''}>
                  <TableCell className="font-medium align-top">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Input
                          value={d.device_name || ''}
                          onChange={(e) => updateRow(d.id, 'device_name', e.target.value)}
                          placeholder="Nome"
                          className="h-8 text-sm"
                        />
                        <span className="shrink-0 text-muted-foreground">-</span>
                        <Input
                          value={d.storage_gb || ''}
                          onChange={(e) => updateRow(d.id, 'storage_gb', e.target.value || '')}
                          placeholder="GB"
                          className="h-8 w-14 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          value={d.color || ''}
                          onChange={(e) => updateRow(d.id, 'color', e.target.value || '')}
                          placeholder="Cor"
                          className="h-8 text-xs"
                        />
                        {isNovoRow ? null : (
                          <>
                            <span className="shrink-0 text-muted-foreground">-</span>
                            <Input
                              inputMode="numeric"
                              value={d.battery || ''}
                              onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, '')
                                if (!digits) {
                                  updateRow(d.id, 'battery', '')
                                  return
                                }
                                let n = Number.parseInt(digits, 10)
                                if (Number.isNaN(n)) {
                                  updateRow(d.id, 'battery', '')
                                  return
                                }
                                if (n > 100) n = 100
                                updateRow(d.id, 'battery', `${n}%`)
                              }}
                              placeholder="Bateria"
                              className="h-8 w-16 text-xs"
                            />
                            <span className="shrink-0 text-muted-foreground">-</span>
                            <select
                              className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs"
                              value={d.condition || ''}
                              onChange={(e) => updateRow(d.id, 'condition', e.target.value || '')}
                            >
                              <option value="">Estado</option>
                              <option value="A+">A+</option>
                              <option value="A">A</option>
                              <option value="A-">A-</option>
                              <option value="B+">B+</option>
                              <option value="B">B</option>
                              <option value="B-">B-</option>
                            </select>
                          </>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      value={d.imei || ''}
                      onChange={(e) => updateRow(d.id, 'imei', e.target.value)}
                      placeholder="IMEI"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      value={d.info || ''}
                      onChange={(e) => updateRow(d.id, 'info', e.target.value)}
                      placeholder="Informações"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    {showPurchaseValue ? (
                      <Input
                        value={
                          d.purchase_value_cents != null
                            ? centsToReais(d.purchase_value_cents)
                            : ''
                        }
                        onChange={(e) => updateMoney(d.id, 'purchase_value_cents', e.target.value)}
                        placeholder="0,00"
                      />
                    ) : (
                      <span className="text-muted-foreground">••••</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {totalCostsCents > 0 ? `R$ ${centsToReais(totalCostsCents)}` : '-'}
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {d.sold ? (
                        <Input
                          value={
                            d.sold_for_cents != null
                              ? centsToReais(d.sold_for_cents)
                              : ''
                          }
                          onChange={(e) => updateMoney(d.id, 'sold_for_cents', e.target.value)}
                          placeholder="Valor da venda"
                          className="h-8 text-xs"
                        />
                      ) : (
                        <>
                          <Input
                            value={
                              d.sale_value_cents != null
                                ? centsToReais(d.sale_value_cents)
                                : ''
                            }
                            onChange={(e) => updateMoney(d.id, 'sale_value_cents', e.target.value)}
                            placeholder="Varejo"
                            className="h-8 text-xs"
                          />
                          {showWholesaleValue ? (
                            <Input
                              value={
                                d.wholesale_value_cents != null
                                  ? centsToReais(d.wholesale_value_cents)
                                  : ''
                              }
                              onChange={(e) =>
                                updateMoney(d.id, 'wholesale_value_cents', e.target.value)
                              }
                              placeholder="Atacado"
                              className="h-8 text-xs"
                            />
                          ) : null}
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <Input
                        type="date"
                        value={d.purchase_date || ''}
                        onChange={(e) => updateRow(d.id, 'purchase_date', e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="date"
                        value={d.sale_date || ''}
                        onChange={(e) => updateRow(d.id, 'sale_date', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right align-top">
                    <ResaleDeviceQuickActionsDropdown
                      device={d}
                      includeSimulate={!d.sold}
                      onSimulate={() => onSimulate(d)}
                      onPrintLabel={() => onPrintLabel(d)}
                      onCopyLojista={() => onCopyLojista(d)}
                      onCopyCliente={() => onCopyCliente(d)}
                      onCopyImei={() => onCopyImei(d)}
                      isAdmin
                      deviceSold={d.sold}
                      onEdit={() => onEdit(d)}
                      onMarkSold={() => onMarkSold(d)}
                      onAddCost={() => onAddCost(d)}
                      onDelete={() => onDelete(d)}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
