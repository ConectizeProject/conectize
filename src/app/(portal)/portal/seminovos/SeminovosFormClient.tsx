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
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { parse3utoolsText } from '@/lib/resale/parse-3utools'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getLabelWindowFeatures } from '@/lib/ordem-print'
import {
  buildCopyClienteText,
  buildCopyLojistaText,
  buildSeminovoLabelHtml,
  type SeminovoActionDevice,
} from '@/lib/seminovos/seminovos-device-actions'
import { ArrowLeft, DollarSign, FileInput, MoreHorizontal, Plus, Store, Tag, Trash2, Undo2, UserRound } from 'lucide-react'
import { ResaleDeviceTermsDialog } from './ResaleDeviceTermsDialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  buildCommissionCostDescription,
  isCommissionCostDescription,
  isSaleDerivedCostDescription,
} from '@/lib/resale/resale-sale-costs'
import {
  commissionFromPercentOfGrossCents,
  grossProfitBeforeCommissionCents,
  paymentFeeCentsForSaleEntries,
} from '@/lib/resale/resale-commission'

type CostRow = { id?: string; description: string; value_cents: number }

type CreditInstallmentFee = { installments: number; fee_percent: number }

type PaymentMethod = {
  id: string
  description: string
  type: string
  fee_percent: number
  credit_installment_fees: CreditInstallmentFee[]
}

type ResaleDevice = {
  id: string
  device_model_id: string | null
  device_name: string | null
  model: string | null
  color: string | null
  storage_gb: string | null
  battery: string | null
  condition: string | null
  /** Observações / detalhes gerais (API pode expor como info). */
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
  payment_method_id: string | null
  payment_installments: number | null
  sale_payment_methods?: Array<{ payment_method_id: string; value_cents?: number | null; installments?: number }> | null
  buyer_name: string | null
  buyer_cpf: string | null
  sale_details: string | null
  stock_type?: string | null
  sale_commission_user_id?: string | null
}

type TeamUser = { id: string; email: string | null; full_name: string | null; role: string }

type SalePaymentEntry = { rowKey: string; payment_method_id: string; value_cents: number | null; installments: number }

function makeSalePaymentRowKey (): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function newEmptySalePaymentRow (): SalePaymentEntry {
  return { rowKey: makeSalePaymentRowKey(), payment_method_id: '', value_cents: null, installments: 1 }
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
    stockType: d.stock_type === 'lacrado' ? 'lacrado' as const : 'seminovo' as const,
  }
}

type Props = {
  deviceId?: string
  isCreate: boolean
  initialDevice?: ResaleDevice | null
  defaultStockType?: 'seminovo' | 'lacrado'
  backHref?: string
}

export function SeminovosFormClient ({
  deviceId,
  isCreate,
  initialDevice,
  defaultStockType = 'seminovo',
  backHref = '/portal/seminovos',
}: Props) {
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
  const [formStockType, setFormStockType] = useState<'seminovo' | 'lacrado'>(init?.stockType ?? defaultStockType)
  const [showSellModal, setShowSellModal] = useState(false)
  const [sellModalDate, setSellModalDate] = useState('')
  const [isSavingSell, setIsSavingSell] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false)
  const [sellPaymentMethods, setSellPaymentMethods] = useState<SalePaymentEntry[]>([])
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [sellCommissionEnabled, setSellCommissionEnabled] = useState(false)
  const [sellCommissionUserId, setSellCommissionUserId] = useState('')
  const [sellCommissionKind, setSellCommissionKind] = useState<'percent' | 'fixed'>('percent')
  const [sellCommissionPercent, setSellCommissionPercent] = useState('')
  const [sellCommissionFixed, setSellCommissionFixed] = useState('')
  const [sellGenerateWarrantyTerm, setSellGenerateWarrantyTerm] = useState(false)
  const [sellBuyerName, setSellBuyerName] = useState('')
  const [sellBuyerCpf, setSellBuyerCpf] = useState('')
  const [sellSaleDetails, setSellSaleDetails] = useState('')
  const [showTermsDialog, setShowTermsDialog] = useState(false)
  const [termsDevice, setTermsDevice] = useState<ResaleDevice | null>(null)

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
          setFormStockType(inited.stockType)
        }
      }
    } finally {
      setIsLoadingDevice(false)
    }
  }, [deviceId, hasInitial])

  useEffect(() => {
    loadDevice()
  }, [loadDevice])

  const loadPaymentMethods = useCallback(async () => {
    setIsLoadingPaymentMethods(true)
    try {
      const res = await portalFetch('/api/portal/payment-methods')
      const data = await res?.json().catch(() => null)
      if (data?.ok && Array.isArray(data.paymentMethods)) {
        setPaymentMethods(data.paymentMethods as PaymentMethod[])
      }
    } finally {
      setIsLoadingPaymentMethods(false)
    }
  }, [])

  useEffect(() => {
    loadPaymentMethods()
  }, [loadPaymentMethods])

  const loadTeamUsers = useCallback(async () => {
    const res = await portalFetch('/api/portal/team-users')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.users)) {
      setTeamUsers(data.users as TeamUser[])
    }
  }, [])

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
      stock_type: formStockType,
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
    setSellModalDate(new Date().toISOString().slice(0, 10))
    setSellPaymentMethods([newEmptySalePaymentRow()])
    setSellGenerateWarrantyTerm(false)
    setSellBuyerName('')
    setSellBuyerCpf('')
    setSellSaleDetails('')
    setSellCommissionEnabled(false)
    setSellCommissionUserId('')
    setSellCommissionKind('percent')
    setSellCommissionPercent('')
    setSellCommissionFixed('')
    loadTeamUsers()
    setShowSellModal(true)
  }

  function getSellPaymentsTotalCents (): number | null {
    const valid = sellPaymentMethods.filter((e) => e.payment_method_id?.trim())
    if (valid.length === 0) return null
    let sum = 0
    for (const e of valid) {
      const v = e.value_cents
      if (v == null || v <= 0) return null
      sum += v
    }
    if (sum <= 0) return null
    return sum
  }

  function previewCommissionCents (
    totalSalesCents: number,
    purchaseCents: number,
    baseOperationalCents: number,
    paymentFeeCents: number
  ): number {
    if (!sellCommissionEnabled || !sellCommissionUserId.trim()) return 0
    if (sellCommissionKind === 'percent') {
      const p = Number.parseFloat(sellCommissionPercent.replace(',', '.'))
      const gross = grossProfitBeforeCommissionCents(
        totalSalesCents,
        purchaseCents,
        baseOperationalCents,
        paymentFeeCents
      )
      return commissionFromPercentOfGrossCents(gross, p)
    }
    return moneyToCentsFromMasked(sellCommissionFixed) ?? 0
  }

  function percentCommissionHintFromForm (): { commissionCents: number; grossCents: number } | null {
    const total = getSellPaymentsTotalCents()
    if (total == null || sellCommissionKind !== 'percent') return null
    const p = Number.parseFloat(sellCommissionPercent.replace(',', '.'))
    if (!Number.isFinite(p) || p <= 0) return null
    const purchaseCents = moneyToCentsFromMasked(formPurchaseValue) ?? 0
    const baseOperationalCents = formCosts.reduce(
      (acc, c) => acc + (isSaleDerivedCostDescription(c.description) ? 0 : (c.value_cents ?? 0)),
      0
    )
    const valid = sellPaymentMethods.filter((e) => e.payment_method_id?.trim())
    const fee = paymentFeeCentsForSaleEntries(valid, paymentMethods)
    const gross = grossProfitBeforeCommissionCents(total, purchaseCents, baseOperationalCents, fee)
    const commissionCents = commissionFromPercentOfGrossCents(gross, p)
    return { commissionCents, grossCents: gross }
  }

  function setSellPaymentMethodAt(i: number, upd: Partial<SalePaymentEntry>) {
    setSellPaymentMethods((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], ...upd }
      return next
    })
  }

  function addSellPaymentMethod() {
    setSellPaymentMethods((prev) => [...prev, newEmptySalePaymentRow()])
  }

  function removeSellPaymentMethod(i: number) {
    setSellPaymentMethods((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function openEditSellModal() {
    if (!deviceId || isSavingSell) return
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${deviceId}`)
      const data = await res?.json().catch(() => null)
      if (data?.ok && data.device) {
        const d = data.device as ResaleDevice
        const salePms = d.sale_payment_methods
        const pms = Array.isArray(salePms) && salePms.length > 0
          ? salePms.map((e) => ({
            rowKey: makeSalePaymentRowKey(),
            payment_method_id: String(e.payment_method_id ?? ''),
            value_cents: e.value_cents != null ? Number(e.value_cents) : null,
            installments: e.installments != null ? Math.max(1, Number(e.installments)) : 1,
          }))
          : (d.payment_method_id
            ? [{ rowKey: makeSalePaymentRowKey(), payment_method_id: d.payment_method_id, value_cents: null, installments: d.payment_installments ?? 1 }]
            : [newEmptySalePaymentRow()])
        let rows: SalePaymentEntry[] = pms.length > 0 ? pms : [newEmptySalePaymentRow()]
        const soldCents = d.sold_for_cents ?? null
        if (rows.length === 1 && (rows[0].value_cents == null || rows[0].value_cents === 0) && soldCents != null) {
          rows = [{ ...rows[0], value_cents: soldCents }]
        }
        setSellPaymentMethods(rows)
        setSellModalDate(d.sale_date || new Date().toISOString().slice(0, 10))
        const hasTermData =
          Boolean((d.buyer_name && d.buyer_name.trim()) ||
            (d.buyer_cpf && d.buyer_cpf.trim()) ||
            (d.sale_details && d.sale_details.trim()))
        setSellGenerateWarrantyTerm(hasTermData)
        setSellBuyerName(d.buyer_name ?? '')
        setSellBuyerCpf(formatCpfCnpj(d.buyer_cpf ?? ''))
        setSellSaleDetails(d.sale_details ?? (hasTermData ? (d.info ?? '') : ''))
        const commLine = (d.costs || []).find((c) => isCommissionCostDescription(c.description))
        const commUserId = d.sale_commission_user_id ?? ''
        if (commLine && commUserId) {
          setSellCommissionEnabled(true)
          setSellCommissionUserId(commUserId)
          setSellCommissionKind('fixed')
          setSellCommissionFixed(maskedFromCents(commLine.value_cents ?? 0))
          setSellCommissionPercent('')
        } else {
          setSellCommissionEnabled(false)
          setSellCommissionUserId('')
          setSellCommissionKind('percent')
          setSellCommissionPercent('')
          setSellCommissionFixed('')
        }
        loadPaymentMethods()
        loadTeamUsers()
        setShowSellModal(true)
      }
    } catch {
      // em caso de erro, não abre o modal
    }
  }

  async function handleConfirmSell() {
    if (!deviceId || isSavingSell) return
    const valueCents = getSellPaymentsTotalCents()
    if (valueCents === null) {
      toast({
        title: 'Valores de pagamento',
        description: 'Informe o valor (R$) em cada forma de pagamento usada. O total da venda é a soma desses valores.',
        variant: 'destructive',
      })
      return
    }

    const validMethods = sellPaymentMethods.filter((e) => e.payment_method_id?.trim())
    if (validMethods.length === 0) {
      toast({ title: 'Forma de pagamento', description: 'Selecione ao menos uma forma de pagamento.', variant: 'destructive' })
      return
    }
    if (sellPaymentMethods.length > 1) {
      const anyEmpty = sellPaymentMethods.some((e) => !e.payment_method_id?.trim())
      if (anyEmpty) {
        toast({ title: 'Forma de pagamento', description: 'Selecione a forma de pagamento em todas as linhas.', variant: 'destructive' })
        return
      }
    }

    const paymentFeeCents = paymentFeeCentsForSaleEntries(validMethods, paymentMethods)

    const baseCosts = formCosts
      .filter((c) => (c.description && c.description.trim()) || (c.value_cents && c.value_cents > 0))
      .map((c) => ({
        description: c.description.trim() || null,
        value_cents: c.value_cents ?? 0,
      }))

    const costsWithoutDerived = baseCosts.filter((c) => !isSaleDerivedCostDescription(c.description))
    const baseOperationalTotal = costsWithoutDerived.reduce((acc, c) => acc + (c.value_cents ?? 0), 0)
    const purchaseCents = moneyToCentsFromMasked(formPurchaseValue) ?? 0

    let costsPayload =
      paymentFeeCents > 0
        ? [
            ...costsWithoutDerived,
            {
              description: 'Taxa forma de pagamento',
              value_cents: paymentFeeCents,
            },
          ]
        : [...costsWithoutDerived]

    let commissionUserIdForDb: string | null = null
    let commissionCents = 0
    if (sellCommissionEnabled) {
      const uid = sellCommissionUserId.trim()
      if (!uid) {
        toast({ title: 'Comissão', description: 'Selecione o colaborador.', variant: 'destructive' })
        return
      }
      const selectedUser = teamUsers.find((u) => u.id === uid)
      if (!selectedUser) {
        toast({ title: 'Comissão', description: 'Colaborador inválido.', variant: 'destructive' })
        return
      }
      if (sellCommissionKind === 'percent') {
        const p = Number.parseFloat(sellCommissionPercent.replace(',', '.'))
        if (!Number.isFinite(p) || p <= 0) {
          toast({ title: 'Comissão', description: 'Informe um percentual válido.', variant: 'destructive' })
          return
        }
        const gross = grossProfitBeforeCommissionCents(
          valueCents,
          purchaseCents,
          baseOperationalTotal,
          paymentFeeCents
        )
        commissionCents = commissionFromPercentOfGrossCents(gross, p)
      } else {
        const fc = moneyToCentsFromMasked(sellCommissionFixed)
        if (fc === null || fc <= 0) {
          toast({ title: 'Comissão', description: 'Informe um valor fixo válido.', variant: 'destructive' })
          return
        }
        commissionCents = fc
      }
      if (commissionCents <= 0) {
        toast({
          title: 'Comissão',
          description:
            sellCommissionKind === 'percent'
              ? 'Com percentual sobre o lucro bruto, o lucro precisa ser positivo e o percentual deve gerar comissão maior que zero.'
              : 'O valor da comissão deve ser maior que zero.',
          variant: 'destructive',
        })
        return
      }
      commissionUserIdForDb = uid
      const label = (selectedUser.full_name || '').trim() || selectedUser.email || 'Colaborador'
      costsPayload = [
        ...costsPayload,
        {
          description: buildCommissionCostDescription(label),
          value_cents: commissionCents,
        },
      ]
    }

    const salePaymentMethodsPayload = validMethods.map((e) => ({
      payment_method_id: e.payment_method_id,
      value_cents: e.value_cents ?? 0,
      installments: e.installments ?? 1,
    }))

    const payload: Record<string, unknown> = {
      sold: true,
      sold_for_cents: valueCents,
      sale_date: sellModalDate || null,
      sale_payment_methods: salePaymentMethodsPayload,
      sale_commission_user_id: sellCommissionEnabled ? commissionUserIdForDb : null,
      buyer_name: sellGenerateWarrantyTerm ? sellBuyerName.trim() || null : null,
      buyer_cpf: sellGenerateWarrantyTerm ? sellBuyerCpf.trim() || null : null,
      sale_details: sellGenerateWarrantyTerm ? sellSaleDetails.trim() || null : null,
      costs: costsPayload,
    }

    setIsSavingSell(true)
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        const updated = data.device as ResaleDevice
        setFormSold(true)
        setFormSoldFor(updated.sold_for_cents != null ? maskedFromCents(updated.sold_for_cents) : '')
        setFormSaleDate(sellModalDate)
        if (updated && Array.isArray(updated.costs)) {
          const mappedCosts = updated.costs.map((c) => ({
            id: c.id,
            description: c.description ?? '',
            value_cents: c.value_cents ?? 0,
          }))
          setFormCosts(mappedCosts.length > 0 ? mappedCosts : [emptyCost()])
        }
        setShowSellModal(false)
        if (sellGenerateWarrantyTerm) {
          setTermsDevice(updated)
          setShowTermsDialog(true)
        }
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
        body: JSON.stringify({
          sold: false,
          sold_for_cents: null,
          sale_date: null,
          payment_method_id: null,
          payment_installments: null,
          sale_payment_methods: [],
          buyer_name: null,
          buyer_cpf: null,
          sale_details: null,
        }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        setFormSold(false)
        setFormSoldFor('')
        setFormSaleDate('')
        setShowTermsDialog(false)
        setFormCosts((prev) =>
          prev.filter((c) => !isSaleDerivedCostDescription(c.description))
        )
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

  function getDeviceSnapshotForActions (): SeminovoActionDevice {
    return {
      device_name: formDeviceName.trim() || null,
      storage_gb: formStorageGb.trim() || null,
      color: formColor.trim() || null,
      battery: formBattery.trim() || null,
      condition: formCondition.trim() || null,
      info: formInfo.trim() || null,
      imei: formImei.trim() || null,
      wholesale_value_cents: moneyToCentsFromMasked(formWholesaleValue) ?? null,
      sale_value_cents: moneyToCentsFromMasked(formSaleValue) ?? null,
    }
  }

  async function handleCopyDeviceData () {
    const text = buildCopyLojistaText(getDeviceSnapshotForActions())
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

  async function handleHeaderCopyLojista () {
    const text = buildCopyLojistaText(getDeviceSnapshotForActions())
    if (!text) {
      toast({ variant: 'destructive', description: 'Nada para copiar. Preencha os dados do aparelho.' })
      return
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        toast({ variant: 'success', title: 'Copiado', description: 'Texto para lojista na área de transferência.', duration: 2000 })
      }
    } catch {
      // ignore
    }
  }

  async function handleHeaderCopyCliente () {
    const text = buildCopyClienteText(getDeviceSnapshotForActions())
    if (!text) {
      toast({ variant: 'destructive', description: 'Nada para copiar. Preencha os dados do aparelho.' })
      return
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        toast({ variant: 'success', title: 'Copiado', description: 'Texto para cliente na área de transferência.', duration: 2000 })
      }
    } catch {
      // ignore
    }
  }

  function handleHeaderPrintLabel () {
    if (typeof window === 'undefined') return
    const win = window.open('', '_blank', getLabelWindowFeatures())
    if (!win) return
    const html = buildSeminovoLabelHtml(getDeviceSnapshotForActions())
    win.document.open()
    win.document.write(html)
    win.document.close()
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="icon" asChild aria-label="Voltar">
            <Link href="/portal/seminovos">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{isCreate ? 'Cadastrar aparelho seminovo' : 'Editar aparelho'}</h1>
            <p className="text-sm text-muted-foreground">
              {isCreate ? 'Preencha os dados do aparelho. Valores em reais.' : 'Altere os dados e salve.'}
            </p>
          </div>
        </div>
        {!isCreate ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2">
                <MoreHorizontal className="h-4 w-4" />
                Ações
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem onClick={handleHeaderPrintLabel}>
                <Tag className="h-4 w-4 mr-2" />
                Imprimir etiqueta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleHeaderCopyLojista}>
                <Store className="h-4 w-4 mr-2" />
                Copiar dados para lojista
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleHeaderCopyCliente}>
                <UserRound className="h-4 w-4 mr-2" />
                Copiar dados para cliente
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
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
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openEditSellModal}
                    disabled={isSavingSell}
                  >
                    Editar venda
                  </Button>
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
                </>
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
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="formStockType">Tipo de estoque</Label>
              <select
                id="formStockType"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={formStockType}
                onChange={(e) => setFormStockType(e.target.value === 'lacrado' ? 'lacrado' : 'seminovo')}
              >
                <option value="seminovo">Seminovo</option>
                <option value="lacrado">Lacrado</option>
              </select>
              <p className="text-xs text-muted-foreground">Define em qual aba da listagem o aparelho aparece.</p>
            </div>
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
              <CardTitle>Resumo da venda</CardTitle>
              <CardDescription>
                O valor total corresponde à soma das formas de pagamento registradas na venda. O lucro real considera compra, custos, taxas e comissão.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="formSoldFor">Total da venda</Label>
                <Input
                  id="formSoldFor"
                  inputMode="decimal"
                  value={formSoldFor}
                  readOnly
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
            <Link href={backHref}>Cancelar</Link>
          </Button>
        </div>
      </form>

      <Dialog open={showSellModal} onOpenChange={(open) => !open && setShowSellModal(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Marcar como vendido</DialogTitle>
            <DialogDescription>
              O valor total da venda é a soma dos valores em cada forma de pagamento. A data da venda será registrada.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Valores sugeridos (referência)</p>
              {moneyToCentsFromMasked(formSaleValue) != null && (
                <p>Varejo cadastrado: R$ {formSaleValue}</p>
              )}
              {moneyToCentsFromMasked(formWholesaleValue) != null && (
                <p>Atacado cadastrado: R$ {formWholesaleValue}</p>
              )}
              {moneyToCentsFromMasked(formSaleValue) == null && moneyToCentsFromMasked(formWholesaleValue) == null && (
                <p>Cadastre preços de varejo ou atacado no formulário para referência; a venda usa apenas os pagamentos abaixo.</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Formas de pagamento</Label>
                <Button type="button" variant="outline" size="sm" onClick={addSellPaymentMethod} className="gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </div>
              <div className="space-y-3">
                {sellPaymentMethods.map((entry, i) => (
                  <div key={entry.rowKey} className="flex flex-wrap items-end gap-2 rounded border p-2 bg-muted/30">
                    <div className="flex-1 min-w-[140px] space-y-1">
                      <Label className="text-xs">Forma</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={entry.payment_method_id || ''}
                        onChange={(e) => {
                          const v = e.target.value
                          setSellPaymentMethodAt(i, { payment_method_id: v, installments: 1 })
                        }}
                        disabled={isLoadingPaymentMethods}
                      >
                        <option value="">Selecione</option>
                        {paymentMethods.map((pm) => (
                          <option key={pm.id} value={pm.id}>
                            {pm.description}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-28 space-y-1">
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input
                        value={entry.value_cents != null ? maskedFromCents(entry.value_cents) : ''}
                        onChange={(e) => {
                          const raw = moneyToCentsFromMasked(formatMoneyInput(e.target.value))
                          setSellPaymentMethodAt(i, { value_cents: raw })
                        }}
                        placeholder="0,00"
                        className="h-9"
                      />
                    </div>
                    {entry.payment_method_id && (() => {
                      const pm = paymentMethods.find((p) => p.id === entry.payment_method_id)
                      const isCredit = pm?.type === 'credito'
                      if (!isCredit) return null
                      const maxInstallments = pm?.credit_installment_fees?.length
                        ? Math.max(...pm.credit_installment_fees.map((f) => f.installments))
                        : 12
                      return (
                        <div className="w-20 space-y-1">
                          <Label className="text-xs">Parcelas</Label>
                          <select
                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            value={String(entry.installments || 1)}
                            onChange={(e) => setSellPaymentMethodAt(i, { installments: Number(e.target.value) || 1 })}
                          >
                            {Array.from({ length: maxInstallments }, (_, n) => n + 1).map((n) => (
                              <option key={n} value={n}>
                                {n}x
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    })()}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSellPaymentMethod(i)}
                      disabled={sellPaymentMethods.length <= 1}
                      aria-label="Remover forma de pagamento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="form-sell-commission"
                  checked={sellCommissionEnabled}
                  onCheckedChange={(v) => setSellCommissionEnabled(v === true)}
                />
                <Label htmlFor="form-sell-commission" className="font-normal cursor-pointer leading-snug">
                  Comissão (descontada do lucro da venda)
                </Label>
              </div>
              {sellCommissionEnabled ? (
                <div className="grid gap-3 sm:grid-cols-2 pl-6 border-t pt-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Colaborador (staff / admin)</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={sellCommissionUserId || ''}
                      onChange={(e) => setSellCommissionUserId(e.target.value)}
                    >
                      <option value="">Selecione…</option>
                      {teamUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {(u.full_name || '').trim() || u.email || u.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs">Tipo de comissão</Label>
                    <RadioGroup
                      value={sellCommissionKind}
                      onValueChange={(v: 'percent' | 'fixed') => setSellCommissionKind(v)}
                      className="flex flex-wrap gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="percent" id="form-comm-pct" />
                        <Label htmlFor="form-comm-pct" className="font-normal cursor-pointer">
                          Percentual sobre o lucro bruto
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fixed" id="form-comm-fix" />
                        <Label htmlFor="form-comm-fix" className="font-normal cursor-pointer">
                          Valor fixo (R$)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    {sellCommissionKind === 'percent' ? (
                      <>
                        <Label className="text-xs">Percentual sobre o lucro bruto (%)</Label>
                        <Input
                          value={sellCommissionPercent}
                          onChange={(e) => setSellCommissionPercent(e.target.value.replace(/[^0-9,.-]/g, ''))}
                          placeholder="Ex: 2,5"
                          className="h-9"
                        />
                        {(() => {
                          const hint = percentCommissionHintFromForm()
                          if (!hint) return null
                          return (
                            <div className="pt-0.5 space-y-0.5">
                              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                Comissão: R$ {maskedFromCents(hint.commissionCents)}
                              </p>
                              {hint.grossCents <= 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  Lucro bruto (venda − compra − custos − taxa) não é positivo; comissão percentual = R$ 0,00.
                                </p>
                              ) : null}
                            </div>
                          )
                        })()}
                      </>
                    ) : (
                      <>
                        <Label className="text-xs">Valor (R$)</Label>
                        <Input
                          value={sellCommissionFixed}
                          onChange={(e) => setSellCommissionFixed(formatMoneyInput(e.target.value))}
                          placeholder="0,00"
                          className="h-9"
                        />
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="form-sell-generate-term"
                  className="mt-0.5"
                  checked={sellGenerateWarrantyTerm}
                  onCheckedChange={(v) => {
                    const on = v === true
                    setSellGenerateWarrantyTerm(on)
                    if (on && !sellSaleDetails.trim() && formInfo.trim()) {
                      setSellSaleDetails(formInfo.trim())
                    }
                  }}
                />
                <div className="space-y-0.5 leading-snug">
                  <Label htmlFor="form-sell-generate-term" className="font-normal cursor-pointer">
                    Gerar termo de garantia
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Só é necessário preencher nome, documento e detalhes quando for imprimir o termo.
                  </p>
                </div>
              </div>
              {sellGenerateWarrantyTerm ? (
                <div className="space-y-3 border-t pt-3 pl-1">
                  <div className="space-y-2">
                    <Label>Nome completo do comprador</Label>
                    <Input
                      value={sellBuyerName}
                      onChange={(e) => setSellBuyerName(e.target.value)}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF/CNPJ do comprador</Label>
                    <Input
                      value={sellBuyerCpf}
                      onChange={(e) => setSellBuyerCpf(formatCpfCnpj(e.target.value))}
                      placeholder="CPF ou CNPJ"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Detalhes do aparelho no termo</Label>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={sellSaleDetails}
                      onChange={(e) => setSellSaleDetails(e.target.value)}
                      placeholder="Texto exibido no termo de compra."
                      rows={3}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Data da venda</Label>
              <Input
                type="date"
                value={sellModalDate}
                onChange={(e) => setSellModalDate(e.target.value)}
              />
            </div>
            <div className="rounded-lg border bg-muted/50 px-4 py-3 space-y-2">
              {(() => {
                const totalCents = getSellPaymentsTotalCents()
                const purchaseCents = moneyToCentsFromMasked(formPurchaseValue) ?? 0
                const baseOperationalCents = formCosts.reduce(
                  (acc, c) => acc + (isSaleDerivedCostDescription(c.description) ? 0 : (c.value_cents ?? 0)),
                  0
                )
                const validPreview = sellPaymentMethods.filter((e) => e.payment_method_id?.trim())
                const paymentFeePreviewCents = paymentFeeCentsForSaleEntries(validPreview, paymentMethods)
                const commPreview =
                  totalCents != null
                    ? previewCommissionCents(
                      totalCents,
                      purchaseCents,
                      baseOperationalCents,
                      paymentFeePreviewCents
                    )
                    : 0
                const costsCents = baseOperationalCents + paymentFeePreviewCents + commPreview
                const lucroCents = totalCents != null ? totalCents - purchaseCents - costsCents : null
                return (
                  <>
                    {totalCents != null ? (
                      <p className="text-sm text-muted-foreground">
                        Total da venda (soma dos pagamentos):{' '}
                        <span className="font-medium text-foreground">R$ {maskedFromCents(totalCents)}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Preencha os valores em cada forma de pagamento para ver o total e o lucro.</p>
                    )}
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lucro real estimado</p>
                      <p className={`text-lg font-bold ${lucroCents != null ? (lucroCents >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : ''}`}>
                        {lucroCents != null ? `R$ ${maskedFromCents(lucroCents)}` : '-'}
                      </p>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowSellModal(false)} disabled={isSavingSell}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmSell} disabled={isSavingSell || getSellPaymentsTotalCents() === null}>
              {isSavingSell ? 'Salvando…' : 'Confirmar venda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ResaleDeviceTermsDialog
        open={showTermsDialog}
        onOpenChange={setShowTermsDialog}
        device={
          termsDevice
            ? {
                id: termsDevice.id,
                device_name: termsDevice.device_name,
                model: termsDevice.model,
                color: termsDevice.color,
                storage_gb: termsDevice.storage_gb,
                battery: termsDevice.battery,
                imei: termsDevice.imei,
                serial: termsDevice.serial,
                sold_for_cents: termsDevice.sold_for_cents ?? null,
                sale_date: termsDevice.sale_date,
                buyer_name: termsDevice.buyer_name ?? null,
                buyer_cpf: termsDevice.buyer_cpf ?? null,
                sale_details: termsDevice.sale_details ?? null,
                payment_method_id: termsDevice.payment_method_id ?? null,
                payment_installments: termsDevice.payment_installments ?? null,
                sale_payment_methods: termsDevice.sale_payment_methods ?? null,
              }
            : null
        }
      />
    </div>
  )
}
