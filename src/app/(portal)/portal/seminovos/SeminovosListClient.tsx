'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDateBr } from '@/lib/utils/format-date'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { getLabelWindowFeatures } from '@/lib/ordem-print'
import { toast } from '@/hooks/use-toast'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import { Textarea } from '@/components/ui/textarea'
import { Copy, DollarSign, MessageCircle, MoreHorizontal, Pencil, Plus, Printer, Receipt, Trash2 } from 'lucide-react'

type CostRow = { id?: string; description: string; value_cents: number }

type ResaleDevice = {
  id: string
  device_name: string | null
  model: string | null
  color: string | null
  storage_gb: string | null
  battery: string | null
  condition: string | null
  info: string | null
  imei: string | null
  imei2?: string | null
  serial?: string | null
  purchase_value_cents: number | null
  wholesale_value_cents: number | null
  sale_value_cents: number | null
  sold_for_cents: number | null
  expected_profit_wholesale_cents: number | null
  sold: boolean
  purchase_date: string | null
  sale_date: string | null
  costs: CostRow[]
}

function centsToReais(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return maskedFromCents(cents)
}

function getModelSortKey(deviceName: string | null): number {
  if (!deviceName || !deviceName.trim()) return 0
  const name = deviceName.trim()
  const numMatch = name.match(/(\d+)/)
  const num = numMatch ? Number.parseInt(numMatch[1], 10) : 0
  let variant = 1
  if (/\bpro\s+max\b/i.test(name)) variant = 3
  else if (/\bpro\b/i.test(name)) variant = 2
  return num * 10 + variant
}

function sortDevices(list: ResaleDevice[]): ResaleDevice[] {
  return [...list].sort((a, b) => {
    if (a.sold !== b.sold) return Number(a.sold) - Number(b.sold)
    if (!a.sold) {
      const keyA = getModelSortKey(a.device_name)
      const keyB = getModelSortKey(b.device_name)
      if (keyA !== keyB) return keyB - keyA
      return (a.device_name || '').localeCompare(b.device_name || '')
    }
    const dateA = a.sale_date || ''
    const dateB = b.sale_date || ''
    if (dateA !== dateB) return dateB.localeCompare(dateA)
    return (a.id || '').localeCompare(b.id || '')
  })
}
export function SeminovosListClient() {
  const [devices, setDevices] = useState<ResaleDevice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<ResaleDevice | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isBulkEdit, setIsBulkEdit] = useState(false)
  const [isSavingBulk, setIsSavingBulk] = useState(false)
  const [editedDevices, setEditedDevices] = useState<ResaleDevice[]>([])
  const [sellModalTarget, setSellModalTarget] = useState<ResaleDevice | null>(null)
  const [sellValue, setSellValue] = useState('')
  const [sellDate, setSellDate] = useState('')
  const [isSavingSell, setIsSavingSell] = useState(false)
  const [costModalTarget, setCostModalTarget] = useState<ResaleDevice | null>(null)
  const [costDescription, setCostDescription] = useState('')
  const [costValue, setCostValue] = useState('')
  const [isSavingCost, setIsSavingCost] = useState(false)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [whatsAppText, setWhatsAppText] = useState('')

  const loadDevices = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await portalFetch('/api/portal/resale-devices')
      const data = await res?.json().catch(() => null)
      if (data?.ok && Array.isArray(data.devices)) {
        setDevices(data.devices)
      }
    } catch {
      setDevices([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  useEffect(() => {
    if (!isBulkEdit) {
      setEditedDevices(sortDevices(devices))
    }
  }, [devices, isBulkEdit])

  async function handleDelete() {
    if (!deleteTarget || isDeleting) return
    setIsDeleting(true)
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        await loadDevices()
        setDeleteTarget(null)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const sortedDevices = sortDevices(devices)
  const rows = isBulkEdit ? editedDevices : sortedDevices

  function updateRow<K extends keyof ResaleDevice>(id: string, field: K, value: ResaleDevice[K]) {
    setEditedDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    )
  }

  function updateMoney(id: string, field: keyof ResaleDevice, raw: string) {
    const masked = formatMoneyInput(raw)
    const cents = moneyToCentsFromMasked(masked)
    setEditedDevices((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, [field]: (cents ?? null) as any } : d
      )
    )
  }

  async function handleStartBulkEdit() {
    setEditedDevices(sortDevices(devices))
    setIsBulkEdit(true)
  }

  function handleCancelBulkEdit() {
    setIsBulkEdit(false)
    setEditedDevices(sortDevices(devices))
  }

  function getChangedUpdates(): Array<{ id: string } & Record<string, unknown>> {
    const originalMap = new Map(sortedDevices.map((d) => [d.id, d]))
    const updates: Array<{ id: string } & Record<string, unknown>> = []
    for (const edited of editedDevices) {
      const orig = originalMap.get(edited.id)
      if (!orig) continue
      const changed: Record<string, unknown> = {}
      const fields: (keyof ResaleDevice)[] = [
        'device_name', 'color', 'storage_gb', 'battery', 'condition', 'info', 'imei',
        'purchase_date', 'sale_date', 'purchase_value_cents', 'wholesale_value_cents', 'sale_value_cents', 'sold_for_cents',
      ]
      for (const k of fields) {
        const v = edited[k]
        const o = orig[k]
        if (v !== o && (v != null || o != null) && String(v ?? '') !== String(o ?? '')) {
          changed[k] = v
        }
      }
      if (Object.keys(changed).length > 0) {
        updates.push({ id: edited.id, ...changed })
      }
    }
    return updates
  }

  async function handleSaveBulkEdit() {
    if (!isBulkEdit || isSavingBulk) return
    const updates = getChangedUpdates()
    if (updates.length === 0) {
      setIsBulkEdit(false)
      return
    }
    setIsSavingBulk(true)
    try {
      const res = await portalFetch('/api/portal/resale-devices/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        await loadDevices()
        setIsBulkEdit(false)
      } else if (data?.error === 'partial_failure' && data?.results) {
        const failed = (data.results as { id: string; ok: boolean }[]).filter((r: { ok: boolean }) => !r.ok)
        if (failed.length > 0) {
          console.error('Erro ao salvar alguns itens:', failed)
        }
        await loadDevices()
        setIsBulkEdit(false)
      }
    } finally {
      setIsSavingBulk(false)
    }
  }

  function openSellModal(d: ResaleDevice) {
    const suggested = d.sale_value_cents ?? d.wholesale_value_cents ?? null
    setSellValue(suggested != null ? centsToReais(suggested) : '')
    setSellDate(new Date().toISOString().slice(0, 10))
    setSellModalTarget(d)
  }

  function openCostModal(d: ResaleDevice) {
    setCostDescription('')
    setCostValue('')
    setCostModalTarget(d)
  }

  function openWhatsAppModal() {
    const today = new Date()
    const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`
    const available = devices.filter((d) => !d.sold)
    const byModelStorage = new Map<string, number>()
    for (const d of available) {
      const name = (d.device_name || '').trim() || 'Aparelho'
      const storage = d.storage_gb ? `${d.storage_gb}GB` : ''
      const key = storage ? `${name} – ${storage}` : name
      const price = Math.min(
        d.sale_value_cents ?? Infinity,
        d.wholesale_value_cents ?? Infinity
      )
      if (price !== Infinity) {
        const current = byModelStorage.get(key)
        if (current === undefined || price < current) byModelStorage.set(key, price)
      }
    }
    const lines = Array.from(byModelStorage.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, cents]) => `${label} - A partir de R$ ${maskedFromCents(cents)}`)
    const devicesBlock = lines.length > 0 ? lines.join('\n') : '(Nenhum aparelho disponível)'
    const text = `🟢 CONECTIZE ATACADO 🟢
📅 Estoque atualizado – ${dateStr}

🚨 LIBERADO HOJE

📦 DISPONÍVEL:

${devicesBlock}

🔒 Seminovos revisados
✅ Garantia 90 dias

⚠️ Reservas por ordem de confirmação
📲 Negociação no privado`
    setWhatsAppText(text)
    setShowWhatsAppModal(true)
  }

  async function handleConfirmCost() {
    const d = costModalTarget
    if (!d || isSavingCost) return
    const valueCents = moneyToCentsFromMasked(costValue)
    if (valueCents === null) return
    setIsSavingCost(true)
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${d.id}/costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: costDescription.trim() || null, value_cents: valueCents }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok && data?.cost) {
        const newCost: CostRow = {
          id: data.cost.id,
          description: data.cost.description ?? '',
          value_cents: data.cost.value_cents ?? 0,
        }
        const updateDevice = (dev: ResaleDevice) =>
          dev.id === d.id ? { ...dev, costs: [...(dev.costs || []), newCost] } : dev
        setDevices((prev) => prev.map(updateDevice))
        setEditedDevices((prev) => prev.map(updateDevice))
        setCostModalTarget(null)
        toast({ description: 'Custo adicionado', duration: 2000 })
      }
    } finally {
      setIsSavingCost(false)
    }
  }

  async function handleConfirmSell() {
    const d = sellModalTarget
    if (!d || isSavingSell) return
    const valueCents = moneyToCentsFromMasked(sellValue)
    if (valueCents === null) return
    setIsSavingSell(true)
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sold: true, sold_for_cents: valueCents, sale_date: sellDate || null }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        setSellModalTarget(null)
        await loadDevices()
        toast({ description: 'Aparelho marcado como vendido', duration: 2000 })
      }
    } finally {
      setIsSavingSell(false)
    }
  }

  async function handleCopyDevice(d: ResaleDevice) {
    const aparelho = [
      d.device_name || '',
      d.storage_gb ? `${d.storage_gb}GB` : '',
      d.color || '',
    ]
      .map((p) => String(p).trim())
      .filter(Boolean)
      .join(' • ')

    const lines = [
      aparelho,
      d.battery ? `Bateria: ${d.battery}` : '',
      d.condition ? `Estado: ${d.condition}` : '',
      d.info ? `Info: ${d.info}` : '',
      d.imei ? `IMEI: ${d.imei}` : '',
    ].filter(Boolean)

    const text = lines.join('\n')
    if (!text) return

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        toast({ description: 'Copiado para a área de transferência', duration: 2000 })
      }
    } catch {
      // ignore clipboard errors
    }
  }

  function handlePrintLabel(d: ResaleDevice) {
    if (typeof window === 'undefined') return
    const win = window.open('', '_blank', getLabelWindowFeatures())
    if (!win) return

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charSet="utf-8" />
  <title>Etiqueta seminovo</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: Arial, sans-serif;
      font-size: 10px;
      line-height: 1.25;
      color: #000;
      width: 45mm;
      min-height: 25mm;
      padding: 2mm 3mm;
      overflow: hidden;
      word-wrap: break-word;
    }
    .label-row {
      margin-bottom: 1mm;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: center;
    }
    .label-row.label-title {
      font-weight: 700;
      font-size: 12px;
      white-space: normal;
      word-break: break-word;
    }
    .label-row.label-imei {
      font-size: 14px;
    }
    .label-row:last-child { margin-bottom: 0; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: 45mm 25mm; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="label-row label-title">${d.device_name}</div>
  <div class="label-row">${d.storage_gb || ''}GB • ${d.color || ''} • ${d.battery || ''}</div>
  <div class="label-row">${d.info || ''}</div>
  <div class="label-row label-imei">${d.imei || ''}</div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`

    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Seminovos</h1>
            <p className="text-sm text-muted-foreground">
              Aparelhos seminovos para revenda. Acesso exclusivo para staff e administrador.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isBulkEdit ? (
              <>
                <Button asChild>
                  <Link href="/portal/seminovos/nova">
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar aparelho
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={openWhatsAppModal}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Texto WhatsApp
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleStartBulkEdit}
                >
                  Edição em massa
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelBulkEdit}
                  disabled={isSavingBulk}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveBulkEdit}
                  disabled={isSavingBulk}
                >
                  {isSavingBulk ? 'Salvando…' : 'Salvar alterações'}
                </Button>
              </>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de aparelhos</CardTitle>
            <CardDescription>
              {devices.length} aparelho(s) cadastrado(s).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum aparelho cadastrado.{' '}
                <Link href="/portal/seminovos/nova" className="text-primary underline">
                  Cadastrar aparelho
                </Link>
              </p>
            ) : (
              <>
                <ResumoFinanceiro devices={devices} />
                <div className="overflow-x-auto">
                  <Table>
                    <colgroup>
                      <col className="w-[18%]" />
                      <col className="w-[7%]" />
                      <col className="w-[7%]" />
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
                        <TableHead>Bateria</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>IMEI</TableHead>
                        <TableHead>Informações</TableHead>
                        <TableHead>Valor compra</TableHead>
                        <TableHead>Custos</TableHead>
                        <TableHead>Valores</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((d) => {
                        const totalCostsCents = (d.costs || []).reduce(
                          (acc, c) => acc + (c.value_cents ?? 0),
                          0
                        )
                        const aparelho = [
                          d.device_name || '',
                          d.storage_gb ? `${d.storage_gb}GB` : '',
                          d.color || '',
                        ]
                          .map((part) => part.trim())
                          .filter(Boolean)
                          .join(' • ')
                        return (
                          <TableRow
                            key={d.id}
                            className={`${!isBulkEdit ? 'cursor-pointer' : ''} ${d.sold ? 'bg-muted/60' : ''}`}
                          >
                            {!isBulkEdit ? (
                              <TableCell colSpan={9} className="relative p-0 align-middle">
                                <Link
                                  href={`/portal/seminovos/${d.id}`}
                                  className="absolute inset-0 z-0"
                                  aria-label={`Abrir aparelho ${aparelho || d.device_name || d.id}`}
                                />
                                <div className="relative z-10 grid items-center py-2 px-4 pointer-events-none [&_button]:pointer-events-auto min-w-0" style={{ gridTemplateColumns: '18fr 7fr 7fr 11fr 14fr 9fr 8fr 12fr 10fr' }}>
                                  <span className="font-medium truncate min-w-0" title={aparelho || d.device_name || ''}>{aparelho || d.device_name || '-'}</span>
                                  <span className="min-w-0">{d.battery || '-'}</span>
                                  <span className="min-w-0">{d.condition || '-'}</span>
                                  <span>
                                    {d.imei ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          e.preventDefault()
                                          navigator?.clipboard?.writeText(d.imei || '').then(() => {
                                            toast({ description: 'Copiado para a área de transferência', duration: 2000 })
                                          }).catch(() => {})
                                        }}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-muted/70 hover:bg-muted border border-border/60 cursor-pointer transition-colors"
                                        title="Clique para copiar"
                                      >
                                        <span className="truncate max-w-[115px]">{d.imei}</span>
                                        <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                                      </button>
                                    ) : '-'}
                                  </span>
                                  <span className="max-w-[220px] truncate min-w-0" title={d.info || ''}>{d.info || '-'}</span>
                                  <span className="min-w-0">{d.purchase_value_cents != null ? `R$ ${centsToReais(d.purchase_value_cents)}` : '-'}</span>
                                  <span className="min-w-0">{totalCostsCents > 0 ? `R$ ${centsToReais(totalCostsCents)}` : '-'}</span>
                                  <span className="whitespace-nowrap min-w-0">
                                    {d.sold ? (
                                      <span className="block text-xs leading-tight">{d.sold_for_cents != null ? `R$ ${centsToReais(d.sold_for_cents)}` : '-'}</span>
                                    ) : (
                                      <>
                                        <span className="block text-xs leading-tight">{d.sale_value_cents != null ? `R$ ${centsToReais(d.sale_value_cents)}` : '-'}</span>
                                        <span className="block text-xs leading-tight text-muted-foreground">{d.wholesale_value_cents != null ? `R$ ${centsToReais(d.wholesale_value_cents)}` : '-'}</span>
                                      </>
                                    )}
                                  </span>
                                  <span className="whitespace-nowrap min-w-0">
                                    {d.sale_date ? (
                                      <>
                                        <span className="block text-xs leading-tight">{d.purchase_date ? formatDateBr(d.purchase_date) : '-'}</span>
                                        <span className="block text-xs leading-tight text-muted-foreground">{formatDateBr(d.sale_date)}</span>
                                      </>
                                    ) : (
                                      <span className="block text-xs leading-tight">{d.purchase_date ? formatDateBr(d.purchase_date) : '-'}</span>
                                    )}
                                  </span>
                                </div>
                              </TableCell>
                            ) : (
                              <>
                            <TableCell className="font-medium" title={aparelho || d.device_name || ''}>
                              {isBulkEdit ? (
                                <Input
                                  value={d.device_name || ''}
                                  onChange={(e) => updateRow(d.id, 'device_name', e.target.value)}
                                  placeholder="Nome do aparelho"
                                />
                              ) : (
                                aparelho || d.device_name || '-'
                              )}
                            </TableCell>
                            <TableCell>
                              {isBulkEdit ? (
                                <Input
                                  inputMode="numeric"
                                  value={d.battery || ''}
                                  onChange={(e) => {
                                    const digits = e.target.value.replace(/\D/g, '')
                                    if (!digits) {
                                      updateRow(d.id, 'battery', '' as any)
                                      return
                                    }
                                    let n = Number.parseInt(digits, 10)
                                    if (Number.isNaN(n)) {
                                      updateRow(d.id, 'battery', '' as any)
                                      return
                                    }
                                    if (n > 100) n = 100
                                    updateRow(d.id, 'battery', (`${n}%` as any))
                                  }}
                                  placeholder="Bateria"
                                />
                              ) : (
                                d.battery || '-'
                              )}
                            </TableCell>
                            <TableCell>
                              {isBulkEdit ? (
                                <select
                                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                                  value={d.condition || ''}
                                  onChange={(e) => updateRow(d.id, 'condition', (e.target.value || '') as any)}
                                >
                                  <option value="">Estado</option>
                                  <option value="A+">A+</option>
                                  <option value="A">A</option>
                                  <option value="A-">A-</option>
                                  <option value="B+">B+</option>
                                  <option value="B">B</option>
                                  <option value="B-">B-</option>
                                </select>
                              ) : (
                                d.condition || '-'
                              )}
                            </TableCell>
                            <TableCell>
                              {isBulkEdit ? (
                                <Input
                                  value={d.imei || ''}
                                  onChange={(e) => updateRow(d.id, 'imei', e.target.value)}
                                  placeholder="IMEI"
                                />
                              ) : d.imei ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigator?.clipboard?.writeText(d.imei || '').then(() => {
                                      toast({ description: 'Copiado para a área de transferência', duration: 2000 })
                                    }).catch(() => { })
                                  }}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-muted/70 hover:bg-muted border border-border/60 cursor-pointer transition-colors"
                                  title="Clique para copiar"
                                >
                                  <span className="truncate max-w-[115px]">{d.imei}</span>
                                  <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                                </button>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate" title={d.info || ''}>
                              {isBulkEdit ? (
                                <Input
                                  value={d.info || ''}
                                  onChange={(e) => updateRow(d.id, 'info', e.target.value)}
                                  placeholder="Informações"
                                />
                              ) : (
                                d.info || '-'
                              )}
                            </TableCell>
                            <TableCell>
                              {isBulkEdit ? (
                                <Input
                                  value={d.purchase_value_cents != null ? centsToReais(d.purchase_value_cents) : ''}
                                  onChange={(e) => updateMoney(d.id, 'purchase_value_cents', e.target.value)}
                                  placeholder="0,00"
                                />
                              ) : (
                                d.purchase_value_cents != null ? `R$ ${centsToReais(d.purchase_value_cents)}` : '-'
                              )}
                            </TableCell>
                            <TableCell>
                              {totalCostsCents > 0 ? `R$ ${centsToReais(totalCostsCents)}` : '-'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {isBulkEdit ? (
                                <div className="flex flex-col gap-1">
                                  {d.sold ? (
                                    <Input
                                      value={d.sold_for_cents != null ? centsToReais(d.sold_for_cents) : ''}
                                      onChange={(e) => updateMoney(d.id, 'sold_for_cents', e.target.value)}
                                      placeholder="Valor da venda"
                                      className="h-8 text-xs"
                                    />
                                  ) : (
                                    <>
                                      <Input
                                        value={d.sale_value_cents != null ? centsToReais(d.sale_value_cents) : ''}
                                        onChange={(e) => updateMoney(d.id, 'sale_value_cents', e.target.value)}
                                        placeholder="Varejo"
                                        className="h-8 text-xs"
                                      />
                                      <Input
                                        value={d.wholesale_value_cents != null ? centsToReais(d.wholesale_value_cents) : ''}
                                        onChange={(e) => updateMoney(d.id, 'wholesale_value_cents', e.target.value)}
                                        placeholder="Atacado"
                                        className="h-8 text-xs"
                                      />
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col text-xs leading-tight">
                                  {d.sold ? (
                                    <span>{d.sold_for_cents != null ? `R$ ${centsToReais(d.sold_for_cents)}` : '-'}</span>
                                  ) : (
                                    <>
                                      <span>{d.sale_value_cents != null ? `R$ ${centsToReais(d.sale_value_cents)}` : '-'}</span>
                                      <span className="text-muted-foreground">{d.wholesale_value_cents != null ? `R$ ${centsToReais(d.wholesale_value_cents)}` : '-'}</span>
                                    </>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {isBulkEdit ? (
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
                              ) : (
                                <div className="flex flex-col text-xs leading-tight">
                                  {d.sale_date ? (
                                    <>
                                      <span>{d.purchase_date ? formatDateBr(d.purchase_date) : '-'}</span>
                                      <span className="text-muted-foreground">{formatDateBr(d.sale_date)}</span>
                                    </>
                                  ) : (
                                    <span>{d.purchase_date ? formatDateBr(d.purchase_date) : '-'}</span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            </>
                            )}
                            <TableCell
                              className="text-right relative z-10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {!d.sold && (
                                    <DropdownMenuItem onClick={() => openSellModal(d)}>
                                      <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                                      Vendido
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => openCostModal(d)}>
                                    <Receipt className="h-3.5 w-3.5 mr-1.5" />
                                    Adicionar custo
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handlePrintLabel(d)}>
                                    <Printer className="h-3.5 w-3.5 mr-1.5" />
                                    Imprimir etiqueta
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleCopyDevice(d)}>
                                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                                    Copiar dados
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/portal/seminovos/${d.id}`}>
                                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                      Editar
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setDeleteTarget(d)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Texto WhatsApp</DialogTitle>
            <DialogDescription>
              Texto formatado para divulgação. Edite conforme necessário e copie para o WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={whatsAppText}
            onChange={(e) => setWhatsAppText(e.target.value)}
            placeholder="Texto para WhatsApp..."
            className="min-h-[320px] resize-y font-mono text-sm"
            dir="ltr"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                navigator?.clipboard?.writeText(whatsAppText).then(() => {
                  toast({ description: 'Copiado para a área de transferência', duration: 2000 })
                }).catch(() => {})
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar
            </Button>
            <Button type="button" onClick={() => setShowWhatsAppModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!costModalTarget} onOpenChange={(open) => !open && setCostModalTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar custo</DialogTitle>
            <DialogDescription>
              Informe a descrição e o valor do custo adicional para este aparelho.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Input
                value={costDescription}
                onChange={(e) => setCostDescription(e.target.value)}
                placeholder="Ex: Troca de tela, frete..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor (R$)</label>
              <Input
                value={costValue}
                onChange={(e) => setCostValue(formatMoneyInput(e.target.value))}
                placeholder="0,00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCostModalTarget(null)} disabled={isSavingCost}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmCost} disabled={isSavingCost || !costValue.trim()}>
              {isSavingCost ? 'Salvando…' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sellModalTarget} onOpenChange={(open) => !open && setSellModalTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como vendido</DialogTitle>
            <DialogDescription>
              Informe o valor e a data da venda. Sugestão preenchida com valor previsto.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor da venda</label>
              <Input
                value={sellValue}
                onChange={(e) => setSellValue(formatMoneyInput(e.target.value))}
                placeholder="0,00"
              />
              {sellModalTarget && (sellModalTarget.sale_value_cents != null || sellModalTarget.wholesale_value_cents != null) && (
                <p className="text-xs text-muted-foreground">
                  Sugestão: valor varejo {sellModalTarget.sale_value_cents != null ? `R$ ${centsToReais(sellModalTarget.sale_value_cents)}` : '-'}
                  {sellModalTarget.wholesale_value_cents != null && sellModalTarget.sale_value_cents !== sellModalTarget.wholesale_value_cents && (
                    <> • valor atacado R$ {centsToReais(sellModalTarget.wholesale_value_cents)}</>
                  )}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data da venda</label>
              <Input
                type="date"
                value={sellDate}
                onChange={(e) => setSellDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSellModalTarget(null)} disabled={isSavingSell}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmSell} disabled={isSavingSell || !sellValue.trim()}>
              {isSavingSell ? 'Salvando…' : 'Confirmar venda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aparelho</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este aparelho? Os custos vinculados também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

type ResumoProps = {
  devices: ResaleDevice[]
}

function ResumoFinanceiro({ devices }: ResumoProps) {
  const disponiveis = devices.filter((d) => !d.sold)
  const qtd = disponiveis.length
  const estoqueCents = disponiveis.reduce(
    (acc, d) => acc + (d.purchase_value_cents ?? 0),
    0
  )
  const margemPrevistaCents = disponiveis.reduce(
    (acc, d) => acc + (d.expected_profit_wholesale_cents ?? 0),
    0
  )

  return (
    <div className="flex flex-wrap gap-4 items-center mb-3 text-sm">
      <div>
        <span className="font-medium">Disponíveis:</span>{' '}
        <span>{qtd}</span>
      </div>
      <div>
        <span className="font-medium">Valor em estoque:</span>{' '}
        <span>R$ {centsToReais(estoqueCents)}</span>
      </div>
      <div>
        <span className="font-medium">Margem prevista (atacado):</span>{' '}
        <span>R$ {centsToReais(margemPrevistaCents)}</span>
      </div>
    </div>
  )
}
