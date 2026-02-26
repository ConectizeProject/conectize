'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { parse3utoolsText } from '@/lib/resale/parse-3utools'
import { ArrowLeft, DollarSign, FileInput, Plus, Trash2, Undo2 } from 'lucide-react'

type CostRow = { id?: string; description: string; value_cents: number }

type ResaleDevice = {
  id: string
  device_model_id: string | null
  device_name: string | null
  model: string | null
  color: string | null
  storage_gb: string | null
  battery: string | null
  condition: string | null
  info: string | null
  imei: string | null
  imei2: string | null
  serial: string | null
  purchase_value_cents: number | null
  wholesale_value_cents: number | null
  expected_profit_wholesale_cents: number | null
  sale_value_cents: number | null
  expected_profit_sale_cents: number | null
  sold_for_cents: number | null
  advertised: boolean
  tested: boolean
  label: string | null
  sold: boolean
  actual_profit_cents: number | null
  purchase_date: string | null
  sale_date: string | null
  created_at: string
  costs: CostRow[]
}

function centsToReais(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}

const emptyCost = (): CostRow => ({ description: '', value_cents: 0 })

function getInitialFromDevice(d: ResaleDevice | null | undefined) {
  if (!d) return null
  const costs = (d.costs && d.costs.length > 0)
    ? d.costs.map((c) => ({ id: c.id, description: c.description ?? '', value_cents: c.value_cents ?? 0 }))
    : [emptyCost()]
  return {
    deviceName: d.device_name ?? d.model ?? '',
    model: d.model ?? '',
    color: d.color ?? '',
    storageGb: d.storage_gb ?? '',
    battery: d.battery ?? '',
    condition: d.condition ?? '',
    info: d.info ?? '',
    imei: d.imei ?? '',
    imei2: d.imei2 ?? '',
    serial: d.serial ?? '',
    purchaseValue: centsToReais(d.purchase_value_cents),
    wholesaleValue: centsToReais(d.wholesale_value_cents),
    expectedProfitWholesale: centsToReais(d.expected_profit_wholesale_cents),
    saleValue: centsToReais(d.sale_value_cents),
    expectedProfitSale: centsToReais(d.expected_profit_sale_cents),
    soldFor: centsToReais((d as { sold_for_cents?: number | null }).sold_for_cents),
    advertised: Boolean(d.advertised),
    tested: Boolean(d.tested),
    label: Boolean(d.label),
    sold: Boolean(d.sold),
    purchaseDate: d.purchase_date ?? '',
    saleDate: d.sale_date ?? '',
    costs,
  }
}

type Props = {
  deviceId?: string
  isCreate: boolean
  initialDevice?: ResaleDevice | null
}

export function SeminovosFormClient({ deviceId, isCreate, initialDevice }: Props) {
  const router = useRouter()
  const init = getInitialFromDevice(initialDevice)
  const hasInitial = Boolean(init)

  const [isLoadingDevice, setIsLoadingDevice] = useState(Boolean(deviceId) && !hasInitial)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [threeUtoolsRaw, setThreeUtoolsRaw] = useState('')

  const [formDeviceName, setFormDeviceName] = useState(init?.deviceName ?? '')
  const [formModel, setFormModel] = useState(init?.model ?? '')
  const [formColor, setFormColor] = useState(init?.color ?? '')
  const [formStorageGb, setFormStorageGb] = useState(init?.storageGb ?? '')
  const [formBattery, setFormBattery] = useState(init?.battery ?? '')
  const [formCondition, setFormCondition] = useState(init?.condition ?? '')
  const [formInfo, setFormInfo] = useState(init?.info ?? '')
  const [formImei, setFormImei] = useState(init?.imei ?? '')
  const [formImei2, setFormImei2] = useState(init?.imei2 ?? '')
  const [formSerial, setFormSerial] = useState(init?.serial ?? '')
  const [formPurchaseValue, setFormPurchaseValue] = useState(init?.purchaseValue ?? '')
  const [formWholesaleValue, setFormWholesaleValue] = useState(init?.wholesaleValue ?? '')
  const [formExpectedProfitWholesale, setFormExpectedProfitWholesale] = useState(init?.expectedProfitWholesale ?? '')
  const [formSaleValue, setFormSaleValue] = useState(init?.saleValue ?? '')
  const [formExpectedProfitSale, setFormExpectedProfitSale] = useState(init?.expectedProfitSale ?? '')
  const [formSoldFor, setFormSoldFor] = useState(init?.soldFor ?? '')
  const [formAdvertised, setFormAdvertised] = useState(init?.advertised ?? false)
  const [formTested, setFormTested] = useState(init?.tested ?? false)
  const [formLabel, setFormLabel] = useState(init?.label ?? false)
  const [formSold, setFormSold] = useState(init?.sold ?? false)
  const [formPurchaseDate, setFormPurchaseDate] = useState(() => {
    if (init) return init.purchaseDate
    if (isCreate) {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    return ''
  })
  const [formSaleDate, setFormSaleDate] = useState(init?.saleDate ?? '')
  const [formCosts, setFormCosts] = useState<CostRow[]>(init?.costs ?? [emptyCost()])
  const [showSellModal, setShowSellModal] = useState(false)
  const [sellModalValue, setSellModalValue] = useState('')
  const [sellModalDate, setSellModalDate] = useState('')
  const [isSavingSell, setIsSavingSell] = useState(false)

  const loadDevice = useCallback(async () => {
    if (!deviceId || hasInitial) return
    setIsLoadingDevice(true)
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${deviceId}`)
      const data = await res?.json().catch(() => null)
      if (data?.ok && data.device) {
        const inited = getInitialFromDevice(data.device as ResaleDevice)
        if (inited) {
          setFormDeviceName(inited.deviceName)
          setFormModel(inited.model)
          setFormColor(inited.color)
          setFormStorageGb(inited.storageGb)
          setFormBattery(inited.battery)
          setFormCondition(inited.condition)
          setFormInfo(inited.info)
          setFormImei(inited.imei)
          setFormImei2(inited.imei2)
          setFormSerial(inited.serial)
          setFormPurchaseValue(inited.purchaseValue)
          setFormWholesaleValue(inited.wholesaleValue)
          setFormExpectedProfitWholesale(inited.expectedProfitWholesale)
          setFormSaleValue(inited.saleValue)
          setFormExpectedProfitSale(inited.expectedProfitSale)
          setFormSoldFor(inited.soldFor)
          setFormAdvertised(inited.advertised)
          setFormTested(inited.tested)
          setFormLabel(inited.label)
          setFormSold(inited.sold)
          setFormPurchaseDate(inited.purchaseDate)
          setFormSaleDate(inited.saleDate)
          setFormCosts(inited.costs)
        }
      }
    } finally {
      setIsLoadingDevice(false)
    }
  }, [deviceId, hasInitial])

  useEffect(() => {
    loadDevice()
  }, [loadDevice])

  function handleParse3utools() {
    const parsed = parse3utoolsText(threeUtoolsRaw)
    if (parsed.model) setFormDeviceName(parsed.model)
    if (parsed.modelNumber) setFormModel(parsed.modelNumber)
    if (parsed.color) setFormColor(parsed.color)
    if (parsed.storage_gb) setFormStorageGb(parsed.storage_gb)
    if (parsed.imei) setFormImei(parsed.imei)
    if (parsed.imei2) setFormImei2(parsed.imei2)
    if (parsed.serial) setFormSerial(parsed.serial)
  }

  function addCost() {
    setFormCosts((prev) => [...prev, emptyCost()])
  }

  function removeCost(index: number) {
    setFormCosts((prev) => prev.filter((_, i) => i !== index))
  }

  function updateCost(index: number, field: 'description' | 'value_cents', value: string | number) {
    setFormCosts((prev) => {
      const next = [...prev]
      if (field === 'description') {
        next[index] = { ...next[index], description: String(value) }
      } else {
        const cents =
          typeof value === 'number'
            ? value
            : moneyToCentsFromMasked(String(value)) ?? 0
        next[index] = { ...next[index], value_cents: cents }
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSaving) return
    setErrorMessage('')

    const costsPayload = formCosts
      .filter((c) => (c.description && c.description.trim()) || (c.value_cents && c.value_cents > 0))
      .map((c) => ({
        description: c.description.trim() || null,
        value_cents: c.value_cents ?? 0,
      }))

    function toReaisNum(s: string): number | null {
      const cents = moneyToCentsFromMasked(s)
      if (cents === null) return null
      return cents / 100
    }

    const payload = {
      device_name: formDeviceName.trim() || null,
      model: formModel.trim() || null,
      color: formColor.trim() || null,
      storage_gb: formStorageGb.trim() || null,
      battery: formBattery.trim() || null,
      condition: formCondition.trim() || null,
      info: formInfo.trim() || null,
      imei: formImei.trim() || null,
      imei2: formImei2.trim() || null,
      serial: formSerial.trim() || null,
      purchase_value: toReaisNum(formPurchaseValue) ?? null,
      wholesale_value: toReaisNum(formWholesaleValue) ?? null,
      expected_profit_wholesale: toReaisNum(formExpectedProfitWholesale) ?? null,
      sale_value: toReaisNum(formSaleValue) ?? null,
      expected_profit_sale: toReaisNum(formExpectedProfitSale) ?? null,
      sold_for: toReaisNum(formSoldFor) ?? null,
      actual_profit: (() => {
        const soldCents = moneyToCentsFromMasked(formSoldFor)
        const purchaseCents = moneyToCentsFromMasked(formPurchaseValue) ?? 0
        const costsCents = formCosts.reduce((acc, c) => acc + (c.value_cents ?? 0), 0)
        if (soldCents === null) return null
        return soldCents - purchaseCents - costsCents
      })(),
      advertised: formAdvertised,
      tested: formTested,
      label: formLabel ? '1' : null,
      sold: formSold,
      purchase_date: formPurchaseDate.trim() || null,
      sale_date: formSaleDate.trim() || null,
      costs: costsPayload,
    }

    setIsSaving(true)
    try {
      if (deviceId) {
        const res = await portalFetch(`/api/portal/resale-devices/${deviceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res?.json().catch(() => null)
        if (data?.ok) {
          router.push('/portal/seminovos')
        } else {
          setErrorMessage(data?.message || 'Não foi possível salvar.')
        }
      } else {
        const res = await portalFetch('/api/portal/resale-devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res?.json().catch(() => null)
        if (data?.ok) {
          router.push('/portal/seminovos')
        } else {
          setErrorMessage(data?.message || 'Não foi possível cadastrar.')
        }
      }
    } catch {
      setErrorMessage('Erro ao salvar.')
    } finally {
      setIsSaving(false)
    }
  }

  const totalCostsCents = formCosts.reduce((acc, c) => acc + (c.value_cents ?? 0), 0)

  useEffect(() => {
    const purchaseCents = moneyToCentsFromMasked(formPurchaseValue) ?? 0
    const wholesaleCents = moneyToCentsFromMasked(formWholesaleValue)
    const saleCents = moneyToCentsFromMasked(formSaleValue)

    if (wholesaleCents != null) {
      const diff = wholesaleCents - purchaseCents
      setFormExpectedProfitWholesale(maskedFromCents(diff))
    } else {
      setFormExpectedProfitWholesale('')
    }

    if (saleCents != null) {
      const diff = saleCents - purchaseCents
      setFormExpectedProfitSale(maskedFromCents(diff))
    } else {
      setFormExpectedProfitSale('')
    }
  }, [formPurchaseValue, formWholesaleValue, formSaleValue])

  function openSellModal() {
    const suggested = formSaleValue || formWholesaleValue || formSoldFor || ''
    setSellModalValue(suggested)
    setSellModalDate(new Date().toISOString().slice(0, 10))
    setShowSellModal(true)
  }

  async function handleConfirmSell() {
    if (!deviceId || isSavingSell) return
    const valueCents = moneyToCentsFromMasked(sellModalValue)
    if (valueCents === null) return
    setIsSavingSell(true)
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sold: true, sold_for_cents: valueCents, sale_date: sellModalDate || null }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        setFormSold(true)
        setFormSoldFor(sellModalValue)
        setFormSaleDate(sellModalDate)
        setShowSellModal(false)
        toast({ description: 'Aparelho marcado como vendido', duration: 2000 })
      } else {
        setErrorMessage(data?.message || 'Não foi possível salvar.')
      }
    } catch {
      setErrorMessage('Erro ao salvar.')
    } finally {
      setIsSavingSell(false)
    }
  }

  async function handleCancelSell() {
    if (!deviceId || isSavingSell) return
    if (!confirm('Cancelar a venda deste aparelho? O valor e a data de venda serão removidos.')) return
    setIsSavingSell(true)
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sold: false, sold_for_cents: null, sale_date: null }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        setFormSold(false)
        setFormSoldFor('')
        setFormSaleDate('')
        toast({ description: 'Venda cancelada', duration: 2000 })
      } else {
        setErrorMessage(data?.message || 'Não foi possível cancelar.')
      }
    } catch {
      setErrorMessage('Erro ao cancelar.')
    } finally {
      setIsSavingSell(false)
    }
  }

  async function handleCopyDeviceData() {
    const lines = [
      [formDeviceName, formStorageGb ? `${formStorageGb}GB` : '', formColor].filter(Boolean).join(' • '),
      formBattery ? `Bateria: ${formBattery}` : '',
      formCondition ? `Estado: ${formCondition}` : '',
      formInfo ? `Info: ${formInfo}` : '',
      formImei ? `IMEI: ${formImei}` : '',
    ].filter(Boolean)

    const text = lines.join('\n')
    if (!text) return

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      }
    } catch {
      // ignore clipboard errors
    }
  }

  if (isLoadingDevice) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Voltar">
          <Link href="/portal/seminovos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isCreate ? 'Cadastrar aparelho seminovo' : 'Editar aparelho'}</h1>
          <p className="text-sm text-muted-foreground">
            {isCreate ? 'Preencha os dados do aparelho. Valores em reais.' : 'Altere os dados e salve.'}
          </p>
        </div>
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Dados 3utools (iDevice details)</CardTitle>
          <CardDescription>
            Cole o texto exportado pelo 3utools e clique em &quot;Ler dados e preencher&quot; para preencher automaticamente modelo, cor, IMEI, IMEI 2 e serial.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Cole aqui o texto do 3utools (iDevice details)..."
            value={threeUtoolsRaw}
            onChange={(e) => setThreeUtoolsRaw(e.target.value)}
            rows={6}
          />
          <Button type="button" variant="secondary" onClick={handleParse3utools}>
            <FileInput className="h-4 w-4 mr-2" />
            Ler dados e preencher
          </Button>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Dados do aparelho</CardTitle>
              <CardDescription>Modelo, identificação e estado.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {!isCreate && !formSold && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={openSellModal}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Vendido
                </Button>
              )}
              {!isCreate && formSold && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelSell}
                  disabled={isSavingSell}
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  Cancelar venda
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyDeviceData}
              >
                Copiar dados
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="formDeviceName">Aparelho</Label>
              <Input id="formDeviceName" value={formDeviceName} onChange={(e) => setFormDeviceName(e.target.value)} placeholder="Ex: iPhone 15 Pro Max" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formColor">Cor</Label>
              <Input id="formColor" value={formColor} onChange={(e) => setFormColor(e.target.value)} placeholder="Ex: Preto" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formModel">Modelo (código)</Label>
              <Input id="formModel" value={formModel} onChange={(e) => setFormModel(e.target.value)} placeholder="Ex: MTMD3 LL/A" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formStorageGb">Gb</Label>
              <Input id="formStorageGb" value={formStorageGb} onChange={(e) => setFormStorageGb(e.target.value)} placeholder="Ex: 128" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formBattery">Bateria</Label>
              <Input
                id="formBattery"
                inputMode="numeric"
                value={formBattery}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '')
                  if (!digits) {
                    setFormBattery('')
                    return
                  }
                  let n = Number.parseInt(digits, 10)
                  if (Number.isNaN(n)) {
                    setFormBattery('')
                    return
                  }
                  if (n > 100) n = 100
                  setFormBattery(`${n}%`)
                }}
                placeholder="Ex: 85%"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="formCondition">Estado</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="h-4 w-4 rounded-full border border-input text-[10px] flex items-center justify-center text-muted-foreground"
                        aria-label="Ajuda sobre estados"
                      >
                        ?
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="start">
                      <p className="text-xs font-semibold mb-1">Classificação do estado:</p>
                      <p className="text-xs">A+: excelente, praticamente sem marcas.</p>
                      <p className="text-xs">A: ótimo estado, leves sinais de uso.</p>
                      <p className="text-xs">A-: bom estado, marcas de uso mais visíveis.</p>
                      <p className="text-xs">B+: uso intenso, mas bem conservado.</p>
                      <p className="text-xs">B: sinais claros de uso/desgaste.</p>
                      <p className="text-xs">B-: bem marcado, muitos riscos ou amassados.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <select
                id="formCondition"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={formCondition}
                onChange={(e) => setFormCondition(e.target.value)}
              >
                <option value="">Selecione</option>
                <option value="A+">A+</option>
                <option value="A">A</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B">B</option>
                <option value="B-">B-</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="formInfo">Informação</Label>
              <Input id="formInfo" value={formInfo} onChange={(e) => setFormInfo(e.target.value)} placeholder="Observações gerais" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formImei">IMEI</Label>
              <Input id="formImei" value={formImei} onChange={(e) => setFormImei(e.target.value)} placeholder="IMEI" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formImei2">IMEI 2</Label>
              <Input id="formImei2" value={formImei2} onChange={(e) => setFormImei2(e.target.value)} placeholder="IMEI 2" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formSerial">Serial</Label>
              <Input id="formSerial" value={formSerial} onChange={(e) => setFormSerial(e.target.value)} placeholder="Serial" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valores (R$)</CardTitle>
            <CardDescription>Compra, atacado, varejo, valor da venda e lucros.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="formPurchaseValue">Valor Compra</Label>
              <Input
                id="formPurchaseValue"
                inputMode="decimal"
                value={formPurchaseValue}
                onChange={(e) => setFormPurchaseValue(formatMoneyInput(e.target.value))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formWholesaleValue">Valor Atacado</Label>
              <Input
                id="formWholesaleValue"
                inputMode="decimal"
                value={formWholesaleValue}
                onChange={(e) => setFormWholesaleValue(formatMoneyInput(e.target.value))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formExpectedProfitWholesale">Lucro Previsto (Atacado)</Label>
              <Input
                id="formExpectedProfitWholesale"
                inputMode="decimal"
                value={formExpectedProfitWholesale}
                readOnly
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formSaleValue">Valor Varejo</Label>
              <Input
                id="formSaleValue"
                inputMode="decimal"
                value={formSaleValue}
                onChange={(e) => setFormSaleValue(formatMoneyInput(e.target.value))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formExpectedProfitSale">Lucro Previsto (Varejo)</Label>
              <Input
                id="formExpectedProfitSale"
                inputMode="decimal"
                value={formExpectedProfitSale}
                readOnly
                placeholder="0,00"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Custos de venda</CardTitle>
                <CardDescription>Lista de custos adicionais (descrição e valor em R$).</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addCost}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar custo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {formCosts.map((cost, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  placeholder="Descrição"
                  value={cost.description}
                  onChange={(e) => updateCost(index, 'description', e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Valor R$"
                  value={cost.value_cents ? (cost.value_cents / 100).toFixed(2).replace('.', ',') : ''}
                  onChange={(e) => updateCost(index, 'value_cents', e.target.value)}
                  className="w-28"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeCost(index)} aria-label="Remover custo">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {totalCostsCents > 0 && (
              <p className="text-xs text-muted-foreground">Total custos: R$ {(totalCostsCents / 100).toFixed(2).replace('.', ',')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status e datas</CardTitle>
            <CardDescription>Anunciado, testado, etiqueta e datas de compra/venda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox id="formAdvertised" checked={formAdvertised} onCheckedChange={(v) => setFormAdvertised(Boolean(v))} />
                <Label htmlFor="formAdvertised">Anunciado</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="formTested" checked={formTested} onCheckedChange={(v) => setFormTested(Boolean(v))} />
                <Label htmlFor="formTested">Testado</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="formLabel" checked={formLabel} onCheckedChange={(v) => setFormLabel(Boolean(v))} />
                <Label htmlFor="formLabel">Etiqueta</Label>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="formPurchaseDate">Data de compra</Label>
                <Input id="formPurchaseDate" type="date" value={formPurchaseDate} onChange={(e) => setFormPurchaseDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="formSaleDate">Data de venda</Label>
                <Input id="formSaleDate" type="date" value={formSaleDate} onChange={(e) => setFormSaleDate(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {formSold && (
          <Card>
            <CardHeader>
              <CardTitle>Valor da venda</CardTitle>
              <CardDescription>Valor pelo qual o aparelho foi vendido e lucro real.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="formSoldFor">Valor da venda</Label>
                <Input
                  id="formSoldFor"
                  inputMode="decimal"
                  value={formSoldFor}
                  onChange={(e) => setFormSoldFor(formatMoneyInput(e.target.value))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="formActualProfit">Lucro real</Label>
                <Input
                  id="formActualProfit"
                  inputMode="decimal"
                  value={(() => {
                    const soldCents = moneyToCentsFromMasked(formSoldFor)
                    const purchaseCents = moneyToCentsFromMasked(formPurchaseValue) ?? 0
                    const costsCents = formCosts.reduce((acc, c) => acc + (c.value_cents ?? 0), 0)
                    if (soldCents === null) return ''
                    const profit = soldCents - purchaseCents - costsCents
                    return maskedFromCents(profit)
                  })()}
                  readOnly
                  placeholder="0,00"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Salvando…' : isCreate ? 'Cadastrar' : 'Salvar'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/portal/seminovos">Cancelar</Link>
          </Button>
        </div>
      </form>

      <Dialog open={showSellModal} onOpenChange={(open) => !open && setShowSellModal(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como vendido</DialogTitle>
            <DialogDescription>
              Informe o valor e a data da venda. Sugestão preenchida com os valores previstos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Valor da venda</Label>
              <Input
                value={sellModalValue}
                onChange={(e) => setSellModalValue(formatMoneyInput(e.target.value))}
                placeholder="0,00"
              />
              {(formSaleValue || formWholesaleValue) && (
                <p className="text-xs text-muted-foreground">
                  Sugestão: valor varejo {formSaleValue ? `R$ ${formSaleValue}` : '-'}
                  {formWholesaleValue && formSaleValue !== formWholesaleValue && (
                    <> • valor atacado R$ {formWholesaleValue}</>
                  )}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Data da venda</Label>
              <Input
                type="date"
                value={sellModalDate}
                onChange={(e) => setSellModalDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowSellModal(false)} disabled={isSavingSell}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmSell} disabled={isSavingSell || !sellModalValue.trim()}>
              {isSavingSell ? 'Salvando…' : 'Confirmar venda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
