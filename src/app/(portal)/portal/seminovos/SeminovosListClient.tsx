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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Copy, Calculator, DollarSign, Eye, EyeOff, MessageCircle, MoreHorizontal, Plus, Receipt, Tag, Trash2, Undo2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

type CostRow = { id?: string; description: string; value_cents: number }

type CreditInstallmentFee = { installments: number; fee_percent: number }

type PaymentMethod = {
  id: string
  description: string
  type: string
  fee_percent: number
  credit_installment_fees: CreditInstallmentFee[]
  sort_order: number
}

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
  actual_profit_cents?: number | null
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
  const [sellValueSource, setSellValueSource] = useState<'varejo' | 'atacado' | 'custom'>('varejo')
  const [sellValue, setSellValue] = useState('')
  const [sellDate, setSellDate] = useState('')
  const [isSavingSell, setIsSavingSell] = useState(false)
  const [costModalTarget, setCostModalTarget] = useState<ResaleDevice | null>(null)
  const [costDescription, setCostDescription] = useState('')
  const [costValue, setCostValue] = useState('')
  const [isSavingCost, setIsSavingCost] = useState(false)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [whatsAppText, setWhatsAppText] = useState('')
  const [showFinancialData, setShowFinancialData] = useState(true)
  const [simulateModalTarget, setSimulateModalTarget] = useState<ResaleDevice | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [simulatePaymentMethodId, setSimulatePaymentMethodId] = useState<string>('')
  const [simulateInstallments, setSimulateInstallments] = useState<number>(1)
  const [simulateValueSource, setSimulateValueSource] = useState<'varejo' | 'atacado' | 'custom'>('varejo')
  const [simulateValue, setSimulateValue] = useState('')

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
    const varejo = d.sale_value_cents ?? null
    const atacado = d.wholesale_value_cents ?? null
    const source = varejo != null ? 'varejo' : atacado != null ? 'atacado' : 'custom'
    setSellValueSource(source)
    setSellValue(varejo != null ? centsToReais(varejo) : atacado != null ? centsToReais(atacado) : '')
    setSellDate(new Date().toISOString().slice(0, 10))
    setSellModalTarget(d)
  }

  function getSellValueCents(): number | null {
    return moneyToCentsFromMasked(sellValue)
  }

  function getEffectiveSellValueCents(): number | null {
    const d = sellModalTarget
    if (!d) return getSellValueCents()
    if (sellValueSource === 'varejo' && d.sale_value_cents != null) return d.sale_value_cents
    if (sellValueSource === 'atacado' && d.wholesale_value_cents != null) return d.wholesale_value_cents
    return getSellValueCents()
  }

  function openCostModal(d: ResaleDevice) {
    setCostDescription('')
    setCostValue('')
    setCostModalTarget(d)
  }

  const loadPaymentMethods = useCallback(async () => {
    const res = await portalFetch('/api/portal/payment-methods')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.paymentMethods)) {
      setPaymentMethods(data.paymentMethods)
    }
  }, [])

  function openSimulateModal(d: ResaleDevice) {
    setSimulateModalTarget(d)
    setSimulatePaymentMethodId('')
    setSimulateInstallments(1)
    const varejo = d.sale_value_cents ?? null
    const atacado = d.wholesale_value_cents ?? null
    const source = varejo != null ? 'varejo' : atacado != null ? 'atacado' : 'custom'
    setSimulateValueSource(source)
    setSimulateValue(varejo != null ? centsToReais(varejo) : atacado != null ? centsToReais(atacado) : '')
    loadPaymentMethods()
  }

  function getSimulateBaseValueCents(): number | null {
    const d = simulateModalTarget
    if (!d) return null
    if (simulateValueSource === 'varejo' && d.sale_value_cents != null) return d.sale_value_cents
    if (simulateValueSource === 'atacado' && d.wholesale_value_cents != null) return d.wholesale_value_cents
    return moneyToCentsFromMasked(simulateValue)
  }

  function getSimulateResult(): {
    receiveCents: number
    feePercent: number
    feeCents: number
    chargeCents: number
    installments?: number
    valuePerInstallmentCents?: number
  } | null {
    const receiveCents = getSimulateBaseValueCents()
    if (receiveCents == null || receiveCents <= 0) return null
    const pm = paymentMethods.find((p) => p.id === simulatePaymentMethodId)
    if (!pm) return null

    if (pm.type === 'dinheiro') {
      return { receiveCents, feePercent: 0, feeCents: 0, chargeCents: receiveCents }
    }

    const feePercent = pm.type === 'credito'
      ? (() => {
          const fees = Array.isArray(pm.credit_installment_fees) ? pm.credit_installment_fees : []
          const sorted = [...fees].sort((a, b) => a.installments - b.installments)
          const exact = sorted.find((f) => f.installments === simulateInstallments)
          const match = exact ?? sorted.filter((f) => f.installments <= simulateInstallments).pop() ?? sorted[0]
          return match ? match.fee_percent : 0
        })()
      : (pm.fee_percent ?? 0)

    if (feePercent >= 100) return { receiveCents, feePercent, feeCents: 0, chargeCents: receiveCents }

    const chargeCents = Math.round(receiveCents / (1 - feePercent / 100))
    const feeCents = chargeCents - receiveCents

    if (pm.type === 'credito') {
      const valuePerInstallmentCents = Math.round(chargeCents / simulateInstallments)
      return {
        receiveCents,
        feePercent,
        feeCents,
        chargeCents,
        installments: simulateInstallments,
        valuePerInstallmentCents,
      }
    }

    return { receiveCents, feePercent, feeCents, chargeCents }
  }

  function openWhatsAppModal() {
    const today = new Date()
    const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`
    const available = devices.filter((d) => !d.sold)
    const byModelStorage = new Map<string, { name: string; storage: string; cents: number }>()
    for (const d of available) {
      const name = (d.device_name || '').trim() || 'Aparelho'
      const storage = d.storage_gb ? `${d.storage_gb}GB` : ''
      const key = `${name}|${storage}`
      const price = d.wholesale_value_cents ?? 0
      if (price > 0) {
        const current = byModelStorage.get(key)
        if (current === undefined || price > current.cents) {
          byModelStorage.set(key, { name, storage, cents: price })
        }
      }
    }
    const entries = Array.from(byModelStorage.values())
      .sort((a, b) => {
        const keyA = getModelSortKey(a.name)
        const keyB = getModelSortKey(b.name)
        if (keyA !== keyB) return keyA - keyB
        const storageA = parseInt(a.storage, 10) || 0
        const storageB = parseInt(b.storage, 10) || 0
        if (storageA !== storageB) return storageA - storageB
        return a.name.localeCompare(b.name)
      })
    const devicesBlock = entries.length > 0
      ? entries.map((e) => `${e.name}\n${e.storage} – R$ ${maskedFromCents(e.cents)}`).join('\n\n')
      : '(Nenhum aparelho disponível)'
    const text = `🟢 CONECTIZE ATACADO 🟢
📅 Estoque atualizado – ${dateStr}

🚨 LIBERADO HOJE

📦 MODELOS DISPONÍVEIS:

${devicesBlock}

🔒 Seminovos revisados
✅ Garantia 90 dias
🔋 Saúde de bateria mínima 80%
⚠️ Reservas por ordem de confirmação

🚨 PROMOÇÃO ESPECIAL
Comprando 3 iPhones
💰 R$100 OFF no total

📲 Garanta o seu no privado`
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
    const valueCents = getEffectiveSellValueCents()
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

  async function handleCancelSell(d: ResaleDevice) {
    if (isSavingSell) return
    if (!confirm('Cancelar a venda deste aparelho? O valor e a data de venda serão removidos.')) return
    setIsSavingSell(true)
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sold: false, sold_for_cents: null, sale_date: null }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        await loadDevices()
        toast({ description: 'Venda cancelada', duration: 2000 })
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
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Lista de aparelhos</CardTitle>
                <CardDescription>
                  {devices.length} aparelho(s) cadastrado(s).
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowFinancialData((v) => !v)}
                title={showFinancialData ? 'Ocultar valores financeiros' : 'Exibir valores financeiros'}
                aria-label={showFinancialData ? 'Ocultar valores financeiros' : 'Exibir valores financeiros'}
              >
                {showFinancialData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
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
                <ResumoFinanceiro devices={devices} showValues={showFinancialData} />
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
                                  <span className="min-w-0">
                                    {showFinancialData ? (d.purchase_value_cents != null ? `R$ ${centsToReais(d.purchase_value_cents)}` : '-') : <Skeleton className="h-4 w-16" />}
                                  </span>
                                  <span className="min-w-0">{totalCostsCents > 0 ? `R$ ${centsToReais(totalCostsCents)}` : '-'}</span>
                                  <span className="whitespace-nowrap min-w-0">
                                    {d.sold ? (
                                      <span className="block text-xs leading-tight">{d.sold_for_cents != null ? `R$ ${centsToReais(d.sold_for_cents)}` : '-'}</span>
                                    ) : (
                                      <>
                                        <span className="block text-xs leading-tight">{d.sale_value_cents != null ? `R$ ${centsToReais(d.sale_value_cents)}` : '-'}</span>
                                        {showFinancialData && (
                                          <span className="block text-xs leading-tight text-muted-foreground">{d.wholesale_value_cents != null ? `R$ ${centsToReais(d.wholesale_value_cents)}` : '-'}</span>
                                        )}
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
                              {showFinancialData ? (
                                isBulkEdit ? (
                                  <Input
                                    value={d.purchase_value_cents != null ? centsToReais(d.purchase_value_cents) : ''}
                                    onChange={(e) => updateMoney(d.id, 'purchase_value_cents', e.target.value)}
                                    placeholder="0,00"
                                  />
                                ) : (
                                  d.purchase_value_cents != null ? `R$ ${centsToReais(d.purchase_value_cents)}` : '-'
                                )
                              ) : (
                                <Skeleton className="h-8 w-20" />
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
                                      {showFinancialData && (
                                        <Input
                                          value={d.wholesale_value_cents != null ? centsToReais(d.wholesale_value_cents) : ''}
                                          onChange={(e) => updateMoney(d.id, 'wholesale_value_cents', e.target.value)}
                                          placeholder="Atacado"
                                          className="h-8 text-xs"
                                        />
                                      )}
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
                                      {showFinancialData && (
                                        <span className="text-muted-foreground">{d.wholesale_value_cents != null ? `R$ ${centsToReais(d.wholesale_value_cents)}` : '-'}</span>
                                      )}
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
                                  {!d.sold ? (
                                    <DropdownMenuItem onClick={() => openSellModal(d)}>
                                      <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                                      Vendido
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => handleCancelSell(d)} disabled={isSavingSell}>
                                      <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                                      Cancelar venda
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => openCostModal(d)}>
                                    <Receipt className="h-3.5 w-3.5 mr-1.5" />
                                    Adicionar custo
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openSimulateModal(d)}>
                                    <Calculator className="h-3.5 w-3.5 mr-1.5" />
                                    Simular
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handlePrintLabel(d)}>
                                    <Tag className="h-3.5 w-3.5 mr-1.5" />
                                    Imprimir etiqueta
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleCopyDevice(d)}>
                                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                                    Copiar dados
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

      <Dialog open={!!simulateModalTarget} onOpenChange={(open) => !open && setSimulateModalTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simular pagamento</DialogTitle>
            <DialogDescription>
              Informe o valor que deseja receber e a forma de pagamento. A taxa é descontada do valor cobrado ao cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {simulateModalTarget && (
              <>
                <div className="space-y-3">
                  <Label>Valor a receber</Label>
                  <RadioGroup
                    value={simulateValueSource}
                    onValueChange={(v: 'varejo' | 'atacado' | 'custom') => {
                      setSimulateValueSource(v)
                      const d = simulateModalTarget
                      if (!d) return
                      if (v === 'varejo' && d.sale_value_cents != null) setSimulateValue(centsToReais(d.sale_value_cents))
                      else if (v === 'atacado' && d.wholesale_value_cents != null) setSimulateValue(centsToReais(d.wholesale_value_cents))
                      else if (v === 'custom') setSimulateValue('')
                    }}
                    className="flex flex-col gap-2"
                  >
                    {simulateModalTarget.sale_value_cents != null && (
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="varejo" id="sim-varejo" />
                        <Label htmlFor="sim-varejo" className="font-normal cursor-pointer">
                          Varejo – R$ {centsToReais(simulateModalTarget.sale_value_cents)}
                        </Label>
                      </div>
                    )}
                    {simulateModalTarget.wholesale_value_cents != null && (
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="atacado" id="sim-atacado" />
                        <Label htmlFor="sim-atacado" className="font-normal cursor-pointer">
                          Atacado – R$ {centsToReais(simulateModalTarget.wholesale_value_cents)}
                        </Label>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="custom" id="sim-custom" />
                      <Label htmlFor="sim-custom" className="font-normal cursor-pointer">
                        Outro valor
                      </Label>
                    </div>
                  </RadioGroup>
                  {(simulateValueSource === 'custom' || (simulateValueSource === 'varejo' && simulateModalTarget.sale_value_cents == null) || (simulateValueSource === 'atacado' && simulateModalTarget.wholesale_value_cents == null)) && (
                    <Input
                      value={simulateValue}
                      onChange={(e) => setSimulateValue(formatMoneyInput(e.target.value))}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Forma de pagamento</Label>
                  <Select
                    value={simulatePaymentMethodId}
                    onValueChange={(v) => {
                      setSimulatePaymentMethodId(v)
                      setSimulateInstallments(1)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((pm) => (
                        <SelectItem key={pm.id} value={pm.id}>
                          {pm.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {simulatePaymentMethodId && (() => {
                  const pm = paymentMethods.find((p) => p.id === simulatePaymentMethodId)
                  if (pm?.type === 'credito') {
                    const fees = Array.isArray(pm.credit_installment_fees) ? pm.credit_installment_fees : []
                    const maxInstallments = fees.length > 0
                      ? Math.max(...fees.map((f) => f.installments))
                      : 12
                    return (
                      <div className="space-y-2">
                        <Label>Parcelas</Label>
                        <Select
                          value={String(simulateInstallments)}
                          onValueChange={(v) => setSimulateInstallments(parseInt(v, 10) || 1)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n}x
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  }
                  return null
                })()}
                {getSimulateResult() && (
                  <div className="rounded-lg border bg-muted/50 px-4 py-3 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resultado</p>
                    {(() => {
                      const r = getSimulateResult()!
                      return (
                        <>
                          <p className="text-sm">
                            Valor a receber: R$ {centsToReais(r.receiveCents)}
                          </p>
                          <p className="text-sm">
                            Valor que preciso cobrar: R$ {centsToReais(r.chargeCents)}
                          </p>
                          {r.installments != null && r.valuePerInstallmentCents != null && (
                            <p className="text-sm">
                              Valor da parcela: R$ {centsToReais(r.valuePerInstallmentCents)}
                            </p>
                          )}
                          {r.feePercent > 0 && (
                            <>
                              <p className="text-sm">
                                Valor do juros: R$ {centsToReais(r.feeCents)}
                              </p>
                              <p className="text-sm">
                                Percentual: {r.feePercent.toFixed(2)}%
                              </p>
                            </>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setSimulateModalTarget(null)}>
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
              Escolha o valor da venda ou informe manualmente. A data da venda será registrada.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-3">
              <Label>Valor da venda</Label>
              <RadioGroup
                value={sellValueSource}
                onValueChange={(v: 'varejo' | 'atacado' | 'custom') => {
                  setSellValueSource(v)
                  const d = sellModalTarget
                  if (!d) return
                  if (v === 'varejo' && d.sale_value_cents != null) setSellValue(centsToReais(d.sale_value_cents))
                  else if (v === 'atacado' && d.wholesale_value_cents != null) setSellValue(centsToReais(d.wholesale_value_cents))
                  else if (v === 'custom') setSellValue('')
                }}
                className="flex flex-col gap-2"
              >
                {sellModalTarget?.sale_value_cents != null && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="varejo" id="sell-varejo" />
                    <Label htmlFor="sell-varejo" className="font-normal cursor-pointer">
                      Varejo – R$ {centsToReais(sellModalTarget.sale_value_cents)}
                    </Label>
                  </div>
                )}
                {sellModalTarget?.wholesale_value_cents != null && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="atacado" id="sell-atacado" />
                    <Label htmlFor="sell-atacado" className="font-normal cursor-pointer">
                      Atacado – R$ {centsToReais(sellModalTarget.wholesale_value_cents)}
                    </Label>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="sell-custom" />
                  <Label htmlFor="sell-custom" className="font-normal cursor-pointer">
                    Outro valor
                  </Label>
                </div>
              </RadioGroup>
              {(sellValueSource === 'custom' || (sellValueSource === 'varejo' && sellModalTarget?.sale_value_cents == null) || (sellValueSource === 'atacado' && sellModalTarget?.wholesale_value_cents == null)) && (
                <Input
                  value={sellValue}
                  onChange={(e) => setSellValue(formatMoneyInput(e.target.value))}
                  placeholder="0,00"
                  className="mt-1"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sell-date">Data da venda</Label>
              <Input
                id="sell-date"
                type="date"
                value={sellDate}
                onChange={(e) => setSellDate(e.target.value)}
              />
            </div>
            {sellModalTarget && (() => {
              const soldCents = getEffectiveSellValueCents()
              const purchaseCents = sellModalTarget.purchase_value_cents ?? 0
              const costsCents = (sellModalTarget.costs || []).reduce((acc, c) => acc + (c.value_cents ?? 0), 0)
              const lucroCents = soldCents != null ? soldCents - purchaseCents - costsCents : null
              return (
                <div className="rounded-lg border bg-muted/50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lucro real</p>
                  <p className={`text-lg font-bold ${lucroCents != null ? (lucroCents >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : ''}`}>
                    {lucroCents != null ? `R$ ${maskedFromCents(lucroCents)}` : '-'}
                  </p>
                </div>
              )
            })()}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSellModalTarget(null)} disabled={isSavingSell}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSell}
              disabled={isSavingSell || getEffectiveSellValueCents() === null}
            >
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
  showValues: boolean
}

function ResumoFinanceiro({ devices, showValues }: ResumoProps) {
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

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const soldThisMonth = devices.filter((d) => {
    if (!d.sold || !d.sale_date) return false
    const [y, m] = d.sale_date.split('-').map(Number)
    return y === year && m === month
  })
  const vendasMesCents = soldThisMonth.reduce((acc, d) => acc + (d.sold_for_cents ?? 0), 0)
  const vendasMesQty = soldThisMonth.length
  const lucroRealMesCents = soldThisMonth.reduce(
    (acc, d) => acc + (d.actual_profit_cents ?? 0),
    0
  )

  const blocks = [
    { title: 'Disponíveis', value: String(qtd), sub: undefined as string | undefined, color: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400', hideValue: false },
    { title: 'Valor em estoque', value: `R$ ${centsToReais(estoqueCents)}`, sub: undefined, color: 'bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-400', hideValue: true },
    { title: 'Margem prevista (atacado)', value: `R$ ${centsToReais(margemPrevistaCents)}`, sub: undefined, color: 'bg-violet-500/15 border-violet-500/30 text-violet-700 dark:text-violet-400', hideValue: true },
    { title: 'Vendas no mês', value: `R$ ${centsToReais(vendasMesCents)}`, sub: `${vendasMesQty} venda(s)`, color: 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400', hideValue: true },
    { title: 'Lucro real (vendas do mês)', value: `R$ ${centsToReais(lucroRealMesCents)}`, sub: undefined, color: 'bg-green-600/20 border-green-600/40 text-green-800 dark:text-green-300', hideValue: true },
  ]

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {blocks.map((b) => (
        <div
          key={b.title}
          className={`rounded-lg border px-4 py-3 min-w-[140px] ${b.color}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">{b.title}</p>
          {showValues || !b.hideValue ? (
            <>
              <p className="text-xl font-bold mt-0.5">{b.value}</p>
              {b.sub != null && <p className="text-xs mt-0.5 opacity-90">{b.sub}</p>}
            </>
          ) : (
            <Skeleton className="h-7 w-20 mt-1" />
          )}
        </div>
      ))}
    </div>
  )
}
