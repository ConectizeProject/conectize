'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import {
  commissionFromPercentOfGrossCents,
  grossProfitBeforeCommissionCents,
  paymentFeeCentsForSaleEntries,
} from '@/lib/resale/resale-commission'
import {
  buildCommissionCostDescription,
  isCommissionCostDescription,
  isSaleDerivedCostDescription,
} from '@/lib/resale/resale-sale-costs'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatCentsBr } from '@/lib/utils/format-money'
import {
  formatMoneyInput,
  maskedFromCents,
  moneyToCentsFromMasked,
} from '@/lib/utils/money'
import {
  ResaleSellAdminProfitCard,
  ResaleSellCommissionFields,
  type ResaleSellCommissionPanelRef,
  type SellCommissionInitial,
  type SellCommissionSnapshot,
} from '@/app/(portal)/portal/seminovos/ResaleSellCommissionPanel'
import { SellPaymentPricingHint } from '@/app/(portal)/portal/seminovos/SellPaymentPricingHint'
import {
  SellTradeInSection,
  type SellTradeInLine,
} from '@/app/(portal)/portal/seminovos/SellTradeInSection'

const DEFAULT_SELL_COMMISSION_INITIAL: SellCommissionInitial = {
  enabled: false,
  userId: '',
  kind: 'fixed',
  percentRaw: '',
  fixedMasked: maskedFromCents(3000),
}

type SellAddonCatalogRow = {
  id: string
  name: string
  sku: string | null
  sale_price_cents: number | null
  cost_price_cents: number | null
  stock: number
}

type SellAddonLine = {
  productId: string
  name: string
  quantity: number
  unitSaleCents: number
  unitCostCents: number
}

type CreditInstallmentFee = { installments: number; fee_percent: number }

type PaymentMethod = {
  id: string
  description: string
  type: string
  fee_percent: number
  credit_installment_fees: CreditInstallmentFee[]
  sort_order: number
}

type TeamUser = {
  id: string
  email: string | null
  full_name: string | null
  role: string
}

type SalePaymentEntry = {
  rowKey: string
  payment_method_id: string
  value_cents: number | null
  installments: number
}

function makeSalePaymentRowKey (): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function newEmptySalePaymentRow (): SalePaymentEntry {
  return {
    rowKey: makeSalePaymentRowKey(),
    payment_method_id: '',
    value_cents: null,
    installments: 1,
  }
}

function buildPaymentRowsFromDevice (
  d: ResaleMarkSoldDevice,
  opts?: { defaultValueCents?: number | null },
): SalePaymentEntry[] {
  const defaultValue = opts?.defaultValueCents ?? null
  const pms =
    Array.isArray(d.sale_payment_methods) && d.sale_payment_methods.length > 0
      ? d.sale_payment_methods.map((e) => ({
        rowKey: makeSalePaymentRowKey(),
        payment_method_id: String(e.payment_method_id ?? ''),
        value_cents: e.value_cents != null ? Number(e.value_cents) : null,
        installments:
          e.installments != null ? Math.max(1, Number(e.installments)) : 1,
      }))
      : d.payment_method_id
        ? [
          {
            rowKey: makeSalePaymentRowKey(),
            payment_method_id: d.payment_method_id,
            value_cents: defaultValue,
            installments: d.payment_installments ?? 1,
          },
        ]
        : [newEmptySalePaymentRow()]
  return pms.length > 0 ? pms : [newEmptySalePaymentRow()]
}

export type ResaleMarkSoldDevice = {
  id: string
  device_name: string | null
  model: string | null
  color: string | null
  storage_gb: string | null
  battery: string | null
  info: string | null
  imei: string | null
  serial?: string | null
  purchase_value_cents: number | null
  wholesale_value_cents: number | null
  sale_value_cents: number | null
  sold_for_cents: number | null
  sale_date: string | null
  costs: Array<{ id?: string; description: string; value_cents: number }>
  payment_method_id?: string | null
  payment_installments?: number | null
  sale_payment_methods?: Array<{
    payment_method_id: string
    value_cents?: number | null
    installments?: number
  }> | null
  buyer_name?: string | null
  buyer_cpf?: string | null
  sale_details?: string | null
  sale_commission_user_id?: string | null
}

export type ResaleMarkSoldDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  device: ResaleMarkSoldDevice | null
  /** 'create' = new sale (default); 'edit' = edit existing sale */
  mode?: 'create' | 'edit'
  isAdmin: boolean
  canViewPurchaseValue?: boolean
  onSold: (updated: ResaleMarkSoldDevice, meta: { generateWarrantyTerm: boolean }) => void
}

export function ResaleMarkSoldDialog ({
  open,
  onOpenChange,
  device,
  mode = 'create',
  isAdmin,
  canViewPurchaseValue = false,
  onSold,
}: ResaleMarkSoldDialogProps) {
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const sellCommissionPanelRef = useRef<ResaleSellCommissionPanelRef>(null)
  const [sellCommissionSnapshot, setSellCommissionSnapshot] =
    useState<SellCommissionSnapshot>(DEFAULT_SELL_COMMISSION_INITIAL)
  const [commissionBoot, setCommissionBoot] = useState<{
    seq: number
    initial: SellCommissionInitial
  }>({
    seq: 0,
    initial: DEFAULT_SELL_COMMISSION_INITIAL,
  })
  const [sellDate, setSellDate] = useState('')
  const [isSavingSell, setIsSavingSell] = useState(false)
  const [sellAddonQuery, setSellAddonQuery] = useState('')
  const [sellAddonBusy, setSellAddonBusy] = useState(false)
  const [sellAddonResults, setSellAddonResults] = useState<SellAddonCatalogRow[]>([])
  const [sellAddonItems, setSellAddonItems] = useState<SellAddonLine[]>([])
  const sellAddonSearchCacheRef = useRef<Map<string, SellAddonCatalogRow[]>>(
    new Map(),
  )
  const [sellPaymentMethods, setSellPaymentMethods] = useState<SalePaymentEntry[]>([])
  const [sellGenerateWarrantyTerm, setSellGenerateWarrantyTerm] = useState(false)
  const [sellBuyerName, setSellBuyerName] = useState('')
  const [sellBuyerCpf, setSellBuyerCpf] = useState('')
  const [sellSaleDetails, setSellSaleDetails] = useState('')
  const [sellTradeInEnabled, setSellTradeInEnabled] = useState(false)
  const [sellTradeInLines, setSellTradeInLines] = useState<SellTradeInLine[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const initKeyRef = useRef<string | null>(null)

  const loadPaymentMethods = useCallback(async () => {
    const res = await portalFetch('/api/portal/payment-methods')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.paymentMethods)) {
      setPaymentMethods(data.paymentMethods)
    }
  }, [])

  const loadTeamUsers = useCallback(async () => {
    const res = await portalFetch('/api/portal/team-users')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.users)) {
      setTeamUsers(data.users as TeamUser[])
    }
  }, [])

  function resetSellFormState () {
    setSellPaymentMethods([])
    setSellDate('')
    setSellGenerateWarrantyTerm(false)
    setSellBuyerName('')
    setSellBuyerCpf('')
    setSellSaleDetails('')
    setSellTradeInEnabled(false)
    setSellTradeInLines([])
    setSellAddonQuery('')
    setSellAddonResults([])
    setSellAddonItems([])
    setSellCommissionSnapshot(DEFAULT_SELL_COMMISSION_INITIAL)
    setCommissionBoot({
      seq: 0,
      initial: DEFAULT_SELL_COMMISSION_INITIAL,
    })
    initKeyRef.current = null
  }

  function openSellModal (d: ResaleMarkSoldDevice) {
    setSellPaymentMethods(buildPaymentRowsFromDevice(d, { defaultValueCents: null }))
    setSellDate(new Date().toISOString().slice(0, 10))
    setSellGenerateWarrantyTerm(false)
    setSellBuyerName('')
    setSellBuyerCpf('')
    setSellSaleDetails('')
    setSellTradeInEnabled(false)
    setSellTradeInLines([])
    setSellAddonQuery('')
    setSellAddonItems([])
    setCommissionBoot((b) => ({
      seq: b.seq + 1,
      initial: DEFAULT_SELL_COMMISSION_INITIAL,
    }))
    void loadPaymentMethods()
    void loadTeamUsers()
  }

  function openEditSellModal (d: ResaleMarkSoldDevice) {
    const soldCents = d.sold_for_cents ?? null
    setSellPaymentMethods(
      buildPaymentRowsFromDevice(d, { defaultValueCents: soldCents }),
    )
    setSellDate(d.sale_date || new Date().toISOString().slice(0, 10))
    const hasTermData = Boolean(
      (d.buyer_name && d.buyer_name.trim()) ||
      (d.buyer_cpf && d.buyer_cpf.trim()) ||
      (d.sale_details && d.sale_details.trim()),
    )
    setSellGenerateWarrantyTerm(hasTermData)
    setSellBuyerName(d.buyer_name ?? '')
    setSellBuyerCpf(formatCpfCnpj(d.buyer_cpf ?? ''))
    setSellSaleDetails(d.sale_details ?? (hasTermData ? (d.info ?? '') : ''))
    const commLine = (d.costs || []).find((c) =>
      isCommissionCostDescription(c.description),
    )
    const commUserId = d.sale_commission_user_id ?? ''
    const commissionInitial: SellCommissionInitial =
      commLine && commUserId
        ? {
          enabled: true,
          userId: commUserId,
          kind: 'fixed',
          percentRaw: '',
          fixedMasked: maskedFromCents(commLine.value_cents ?? 0),
        }
        : DEFAULT_SELL_COMMISSION_INITIAL
    setSellTradeInEnabled(false)
    setSellTradeInLines([])
    setSellAddonQuery('')
    setSellAddonItems([])
    setCommissionBoot((b) => ({ seq: b.seq + 1, initial: commissionInitial }))
    void loadPaymentMethods()
    void loadTeamUsers()
  }

  useEffect(() => {
    setSellCommissionSnapshot(commissionBoot.initial)
  }, [commissionBoot.seq, commissionBoot.initial])

  useEffect(() => {
    if (!open || !device) {
      if (!open) resetSellFormState()
      return
    }
    const key = `${mode}:${device.id}`
    if (initKeyRef.current === key) return
    initKeyRef.current = key
    if (mode === 'edit') {
      openEditSellModal(device)
    } else {
      openSellModal(device)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once per open+device+mode
  }, [open, device, mode])

  useEffect(() => {
    if (!open || !device) {
      setSellAddonResults([])
      return
    }
    const q = sellAddonQuery.trim()
    if (q.length < 2) {
      setSellAddonResults([])
      setSellAddonBusy(false)
      return
    }
    const cached = sellAddonSearchCacheRef.current.get(q)
    if (cached) {
      setSellAddonResults(cached)
      setSellAddonBusy(false)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    const t = window.setTimeout(() => {
      void (async () => {
        setSellAddonBusy(true)
        try {
          const res = await portalFetch(
            `/api/portal/pdv/catalog?q=${encodeURIComponent(q)}`,
            { signal: controller.signal },
          )
          const data = await res?.json().catch(() => null)
          if (cancelled) return
          if (data?.ok && Array.isArray(data.products)) {
            const products = data.products as SellAddonCatalogRow[]
            sellAddonSearchCacheRef.current.set(q, products)
            setSellAddonResults(products)
          } else {
            setSellAddonResults([])
          }
        } finally {
          if (!cancelled) setSellAddonBusy(false)
        }
      })()
    }, 280)
    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(t)
    }
  }, [open, device, sellAddonQuery])

  function getValidSellTradeInLines (): SellTradeInLine[] {
    if (!sellTradeInEnabled) return []
    return sellTradeInLines.filter(
      (l) => l.deviceName.trim() && l.valueCents != null && l.valueCents > 0,
    )
  }

  function getSellTradeInTotalCents (): number {
    return getValidSellTradeInLines().reduce(
      (acc, l) => acc + (l.valueCents ?? 0),
      0,
    )
  }

  function setSellPaymentMethodAt (i: number, upd: Partial<SalePaymentEntry>) {
    setSellPaymentMethods((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], ...upd }
      return next
    })
  }

  function addSellPaymentMethod () {
    setSellPaymentMethods((prev) => [...prev, newEmptySalePaymentRow()])
  }

  function removeSellPaymentMethod (i: number) {
    setSellPaymentMethods((prev) => prev.filter((_, idx) => idx !== i))
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

  function getSellAddonRevenueCents (): number {
    return sellAddonItems.reduce(
      (acc, l) => acc + l.quantity * l.unitSaleCents,
      0,
    )
  }

  function getSellAddonCostTotalCents (): number {
    return sellAddonItems.reduce(
      (acc, l) => acc + l.quantity * l.unitCostCents,
      0,
    )
  }

  function getSellCashNetFromPaymentsCents (): number | null {
    const valid = sellPaymentMethods.filter((e) => e.payment_method_id?.trim())
    if (valid.length === 0) return 0
    const sum = getSellPaymentsTotalCents()
    if (sum == null) return null
    const fee = paymentFeeCentsForSaleEntries(valid, paymentMethods)
    return sum - fee
  }

  function getSellNetFromPaymentsCents (): number | null {
    const cashNet = getSellCashNetFromPaymentsCents()
    if (cashNet === null) return null
    const tradeIn = getSellTradeInTotalCents()
    const total = cashNet + tradeIn
    if (total <= 0) return null
    return total
  }

  /** Valor bruto do aparelho (total cobrado nas formas de pagamento − extras). */
  function getSellDeviceSaleCents (): number | null {
    const gross = getSellPaymentsTotalCents()
    if (gross === null) return null
    const deviceSale = gross - getSellAddonRevenueCents()
    return deviceSale > 0 ? deviceSale : null
  }

  /** Receita bruta da operação: pagamentos + troca (taxas são deduzidas no painel). */
  function getSellTransactionTotalCents (): number | null {
    const gross = getSellPaymentsTotalCents()
    const tradeIn = getSellTradeInTotalCents()
    if (gross === null && tradeIn <= 0) return null
    const total = (gross ?? 0) + tradeIn
    if (total <= 0) return null
    return total
  }

  function addSellAddonProduct (p: SellAddonCatalogRow) {
    const unitSale = Number(p.sale_price_cents) || 0
    const unitCost = Number(p.cost_price_cents) || 0
    setSellAddonItems((prev) => {
      const idx = prev.findIndex((x) => x.productId === p.id)
      if (idx < 0) {
        return [
          ...prev,
          {
            productId: p.id,
            name: p.name,
            quantity: 1,
            unitSaleCents: unitSale,
            unitCostCents: unitCost,
          },
        ]
      }
      const next = [...prev]
      next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
      return next
    })
    setSellAddonQuery('')
    setSellAddonResults([])
  }

  function updateSellAddonQty (productId: string, quantity: number) {
    const q = Math.max(1, Math.round(Number(quantity) || 1))
    setSellAddonItems((prev) =>
      prev.map((x) => (x.productId === productId ? { ...x, quantity: q } : x)),
    )
  }

  function updateSellAddonUnitSaleMasked (productId: string, masked: string) {
    const cents = moneyToCentsFromMasked(formatMoneyInput(masked))
    setSellAddonItems((prev) =>
      prev.map((x) =>
        x.productId === productId
          ? {
            ...x,
            unitSaleCents: cents === null ? 0 : Math.max(0, cents),
          }
          : x,
      ),
    )
  }

  function removeSellAddonLine (productId: string) {
    setSellAddonItems((prev) => prev.filter((x) => x.productId !== productId))
  }

  function handleDialogOpenChange (nextOpen: boolean) {
    if (isSavingSell && !nextOpen) return
    onOpenChange(nextOpen)
  }

  async function handleConfirmSell () {
    const d = device
    if (!d || isSavingSell) return

    const validMethods = sellPaymentMethods.filter((e) =>
      e.payment_method_id?.trim(),
    )
    const tradeInLines = getValidSellTradeInLines()
    const tradeInTotal = getSellTradeInTotalCents()

    if (sellTradeInEnabled && tradeInLines.length === 0) {
      toast({
        title: 'Aparelho na troca',
        description:
          'Informe ao menos um aparelho com nome e valor para a troca.',
        variant: 'destructive',
      })
      return
    }

    if (validMethods.length > 0) {
      const paymentsSumCheck = getSellPaymentsTotalCents()
      if (paymentsSumCheck === null) {
        toast({
          title: 'Valores de pagamento',
          description:
            'Informe o valor (R$) em cada forma de pagamento usada.',
          variant: 'destructive',
        })
        return
      }
    }

    if (validMethods.length === 0 && tradeInTotal <= 0) {
      toast({
        title: 'Pagamento',
        description:
          'Informe ao menos uma forma de pagamento ou aparelho(s) na troca.',
        variant: 'destructive',
      })
      return
    }

    const transactionTotal = getSellTransactionTotalCents()
    if (transactionTotal === null || transactionTotal <= 0) {
      toast({
        title: 'Valor da venda',
        description:
          'O total da venda (pagamentos + troca) deve ser maior que zero.',
        variant: 'destructive',
      })
      return
    }

    if (sellPaymentMethods.length > 1) {
      const anyEmpty = sellPaymentMethods.some(
        (e) => !e.payment_method_id?.trim(),
      )
      if (anyEmpty) {
        toast({
          title: 'Forma de pagamento',
          description: 'Selecione a forma de pagamento em todas as linhas.',
          variant: 'destructive',
        })
        return
      }
    }

    const paymentsSum = getSellPaymentsTotalCents() ?? 0

    const paymentFeeCents = paymentFeeCentsForSaleEntries(
      validMethods,
      paymentMethods,
    )

    const baseCosts = (d.costs || []).map((c) => ({
      description: (c.description ?? '') || null,
      value_cents: c.value_cents ?? 0,
    }))

    const costsWithoutDerived = baseCosts.filter(
      (c) => !isSaleDerivedCostDescription(c.description),
    )
    const addonOpCents = getSellAddonCostTotalCents()
    const addonCostLines =
      sellAddonItems.length > 0
        ? sellAddonItems.map((l) => ({
          description: `${l.name} (custo estoque) × ${l.quantity}`,
          value_cents: l.quantity * l.unitCostCents,
        }))
        : []
    const baseOperationalTotal =
      costsWithoutDerived.reduce(
        (acc, c) => acc + (c.value_cents ?? 0),
        0,
      ) + addonOpCents
    const purchaseCents = d.purchase_value_cents ?? 0

    const comm = sellCommissionPanelRef.current?.getValues()
    const sellCommissionEnabled = comm?.enabled ?? false
    const sellCommissionUserId = comm?.userId ?? ''
    const sellCommissionKind = comm?.kind ?? 'percent'
    const sellCommissionPercent = comm?.percentRaw ?? ''
    const sellCommissionFixed = comm?.fixedMasked ?? ''

    let costsPayload = [...costsWithoutDerived, ...addonCostLines]
    if (paymentFeeCents > 0) {
      costsPayload.push({
        description: 'Taxa forma de pagamento',
        value_cents: paymentFeeCents,
      })
    }

    let commissionUserIdForDb: string | null = null
    let commissionCents = 0
    if (sellCommissionEnabled) {
      const uid = sellCommissionUserId.trim()
      if (!uid) {
        toast({
          title: 'Comissão',
          description: 'Selecione o colaborador.',
          variant: 'destructive',
        })
        return
      }
      const selectedUser = teamUsers.find((u) => u.id === uid)
      if (!selectedUser) {
        toast({
          title: 'Comissão',
          description: 'Colaborador inválido.',
          variant: 'destructive',
        })
        return
      }
      if (sellCommissionKind === 'percent') {
        const p = Number.parseFloat(sellCommissionPercent.replace(',', '.'))
        if (!Number.isFinite(p) || p <= 0) {
          toast({
            title: 'Comissão',
            description: 'Informe um percentual válido.',
            variant: 'destructive',
          })
          return
        }
        const gross = grossProfitBeforeCommissionCents(
          paymentsSum,
          purchaseCents,
          baseOperationalTotal,
          paymentFeeCents,
          tradeInTotal,
        )
        commissionCents = commissionFromPercentOfGrossCents(gross, p)
      } else {
        const fc = moneyToCentsFromMasked(sellCommissionFixed)
        if (fc === null || fc <= 0) {
          toast({
            title: 'Comissão',
            description: 'Informe um valor fixo válido.',
            variant: 'destructive',
          })
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
      const label =
        (selectedUser.full_name || '').trim() ||
        selectedUser.email ||
        'Colaborador'
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
      sold_for_cents: transactionTotal,
      sale_date: sellDate || null,
      sale_payment_methods: salePaymentMethodsPayload,
      sale_commission_user_id: sellCommissionEnabled
        ? commissionUserIdForDb
        : null,
      buyer_name: sellGenerateWarrantyTerm
        ? sellBuyerName.trim() || null
        : null,
      buyer_cpf: sellGenerateWarrantyTerm ? sellBuyerCpf.trim() || null : null,
      sale_details: sellGenerateWarrantyTerm
        ? sellSaleDetails.trim() || null
        : null,
      costs: costsPayload,
      ...(sellAddonItems.length > 0
        ? {
          addon_inventory_lines: sellAddonItems.map((l) => ({
            product_id: l.productId,
            quantity: l.quantity,
          })),
        }
        : {}),
      ...(tradeInLines.length > 0
        ? {
          trade_in_devices: tradeInLines.map((l) => ({
            device_name: l.deviceName.trim(),
            imei: l.imei.trim() || null,
            info: l.info.trim() || null,
            condition: l.condition.trim() || null,
            value_cents: l.valueCents,
          })),
        }
        : {}),
    }

    setIsSavingSell(true)
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        const updated = data.device as ResaleMarkSoldDevice
        const generateWarrantyTerm = sellGenerateWarrantyTerm
        onOpenChange(false)
        onSold(updated, { generateWarrantyTerm })
        toast({ description: 'Aparelho marcado como vendido', duration: 2000 })
      } else if (data?.error === 'stock_unavailable') {
        toast({
          title: 'Estoque insuficiente',
          description:
            'Um dos produtos extras não tem quantidade suficiente em estoque para esta venda.',
          variant: 'destructive',
        })
      } else if (data?.error === 'trade_in_table_missing') {
        toast({
          title: 'Banco de dados',
          description:
            'A tabela de troca na venda ainda não existe no Supabase. Execute a migration 20260519120000_resale_device_trade_ins (SQL em supabase/scripts/apply-resale-device-trade-ins.sql).',
          variant: 'destructive',
        })
      } else if (data?.error === 'trade_in_failed') {
        toast({
          title: 'Troca',
          description:
            data?.detail
              ? `Não foi possível cadastrar os aparelhos em troca: ${data.detail}`
              : 'Não foi possível cadastrar os aparelhos recebidos em troca. A venda foi revertida.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsSavingSell(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-5xl w-[min(96vw,72rem)] max-h-[90vh] overflow-y-auto gap-0">
        <DialogHeader className="pb-2">
          <DialogTitle>Marcar como vendido</DialogTitle>
          <DialogDescription>
            Informe data, formas de pagamento, troca, comissão, extras e termo de garantia.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 py-4 lg:grid-cols-2 lg:gap-6 lg:items-start">
          <div className="flex flex-col gap-4 min-w-0">
            {device ? (
              <>
                <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm space-y-2">
                  <p className="font-medium text-foreground">
                    {device.device_name ||
                      device.model ||
                      'Aparelho'}
                  </p>
                  <p className="text-muted-foreground text-xs leading-snug">
                    {[
                      device.model,
                      device.storage_gb,
                      device.color,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {device.battery?.trim() ? (
                    <p className="text-xs text-muted-foreground">
                      Bateria: {device.battery}
                    </p>
                  ) : null}
                  {device.imei?.trim() ? (
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      IMEI: {device.imei}
                    </p>
                  ) : null}
                  {device.serial?.trim() ? (
                    <p className="text-xs text-muted-foreground">
                      S/N: {device.serial}
                    </p>
                  ) : null}
                </div>
                <ResaleSellCommissionFields
                  key={commissionBoot.seq}
                  ref={sellCommissionPanelRef}
                  device={device}
                  sellPaymentMethods={sellPaymentMethods}
                  paymentMethods={paymentMethods}
                  teamUsers={teamUsers}
                  initial={commissionBoot.initial}
                  addonCostTotalCents={getSellAddonCostTotalCents()}
                  tradeInTotalCents={getSellTradeInTotalCents()}
                  onSnapshotChange={setSellCommissionSnapshot}
                />
                <SellTradeInSection
                  enabled={sellTradeInEnabled}
                  onEnabledChange={setSellTradeInEnabled}
                  lines={sellTradeInLines}
                  onLinesChange={setSellTradeInLines}
                />
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="sell-generate-term"
                      className="mt-0.5"
                      checked={sellGenerateWarrantyTerm}
                      onCheckedChange={(v) => {
                        const on = v === true
                        setSellGenerateWarrantyTerm(on)
                        if (
                          on &&
                          !sellSaleDetails.trim() &&
                          device?.info?.trim()
                        ) {
                          setSellSaleDetails(device.info.trim())
                        }
                      }}
                    />
                    <Label
                      htmlFor="sell-generate-term"
                      className="font-normal cursor-pointer leading-snug"
                    >
                      Gerar termo de garantia
                    </Label>
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
                          onChange={(e) =>
                            setSellBuyerCpf(formatCpfCnpj(e.target.value))
                          }
                          placeholder="CPF ou CNPJ"
                          inputMode="numeric"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Detalhes do aparelho no termo</Label>
                        <Textarea
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
                  <Label htmlFor="sell-date">Data da venda</Label>
                  <Input
                    id="sell-date"
                    type="date"
                    value={sellDate}
                    onChange={(e) => setSellDate(e.target.value)}
                  />
                </div>
              </>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 min-w-0">
            {device ? (
              <>
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-sm">Adicionar produto à venda</Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={sellAddonQuery}
                          onChange={(e) => setSellAddonQuery(e.target.value)}
                          placeholder="Buscar por nome, SKU ou código…"
                          className="h-9 pl-8"
                          disabled={!device}
                        />
                        {sellAddonQuery.trim().length >= 2 ? (
                          <div className="absolute z-30 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                            {sellAddonBusy ? (
                              <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Buscando...
                              </div>
                            ) : sellAddonResults.length > 0 ? (
                              <ul className="max-h-56 overflow-y-auto divide-y text-sm">
                                {sellAddonResults.map((p) => (
                                  <li key={p.id}>
                                    <button
                                      type="button"
                                      className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-muted/60"
                                      onClick={() => addSellAddonProduct(p)}
                                    >
                                      <span className="truncate font-medium">{p.name}</span>
                                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                        {p.sale_price_cents != null
                                          ? formatCentsBr(p.sale_price_cents)
                                          : '—'}{' '}
                                        · est. {p.stock}
                                      </span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="p-3 text-xs text-muted-foreground">
                                Nenhum produto encontrado.
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {sellAddonQuery.trim().length > 0 &&
                  sellAddonQuery.trim().length < 2 ? (
                    <p className="text-xs text-muted-foreground py-1">
                      Continue digitando para filtrar o catálogo.
                    </p>
                  ) : null}
                  {sellAddonItems.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Itens na venda
                      </p>
                      <div className="hidden md:grid md:grid-cols-12 md:gap-3 text-xs font-medium text-muted-foreground px-1">
                        <div className="md:col-span-5">Produto</div>
                        <div className="md:col-span-2">Qtd.</div>
                        <div className="md:col-span-2">Venda (R$)</div>
                        <div className="md:col-span-2">Total</div>
                        <div className="md:col-span-1 text-right">Ações</div>
                      </div>
                      <ul className="space-y-3">
                        {sellAddonItems.map((line) => (
                          <li
                            key={line.productId}
                            className="grid gap-3 md:grid-cols-12 items-end"
                          >
                            <div className="md:col-span-5 space-y-1">
                              <Label className="md:hidden">Produto</Label>
                              <Input value={line.name} readOnly className="h-9" />
                            </div>
                            <div className="md:col-span-2 space-y-1">
                              <Label className="md:hidden">Qtd.</Label>
                              <Input
                                type="number"
                                min={1}
                                className="h-9"
                                value={line.quantity}
                                onChange={(e) =>
                                  updateSellAddonQty(
                                    line.productId,
                                    Number(e.target.value),
                                  )
                                }
                              />
                            </div>
                            <div className="md:col-span-2 space-y-1">
                              <Label className="md:hidden">Venda (R$)</Label>
                              <Input
                                className="h-9"
                                value={maskedFromCents(line.unitSaleCents)}
                                onChange={(e) =>
                                  updateSellAddonUnitSaleMasked(
                                    line.productId,
                                    e.target.value,
                                  )
                                }
                                inputMode="decimal"
                                placeholder="0,00"
                              />
                            </div>
                            <div className="md:col-span-2 space-y-1">
                              <Label className="md:hidden">Total</Label>
                              <Input
                                value={maskedFromCents(
                                  line.quantity * line.unitSaleCents,
                                )}
                                readOnly
                                className="h-9"
                              />
                            </div>
                            <div className="md:col-span-1 flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                                onClick={() => removeSellAddonLine(line.productId)}
                                aria-label="Remover item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Formas de pagamento</Label>
                  </div>
                  <div className="space-y-3">
                    <div className="hidden md:grid md:grid-cols-12 md:gap-3 text-xs font-medium text-muted-foreground px-1">
                      <div className="md:col-span-6 flex items-center gap-0.5">
                        <span>Forma de pagamento</span>
                        {device ? (
                          <SellPaymentPricingHint
                            purchaseValueCents={device.purchase_value_cents}
                            wholesaleValueCents={device.wholesale_value_cents}
                            saleValueCents={device.sale_value_cents}
                            costs={device.costs}
                            canViewPurchaseValue={isAdmin && canViewPurchaseValue}
                          />
                        ) : null}
                      </div>
                      <div className="md:col-span-3">Valor</div>
                      <div className="md:col-span-2">Parcelas</div>
                      <div className="md:col-span-1 text-right">Ações</div>
                    </div>
                    {sellPaymentMethods.map((entry, i) => (
                      <div
                        key={entry.rowKey}
                        className="grid gap-3 md:grid-cols-12 items-end"
                      >
                        <div className="md:col-span-6 space-y-1">
                          <div className="flex items-center gap-0.5 md:hidden">
                            <Label>Forma de pagamento</Label>
                            {device ? (
                              <SellPaymentPricingHint
                                purchaseValueCents={device.purchase_value_cents}
                                wholesaleValueCents={device.wholesale_value_cents}
                                saleValueCents={device.sale_value_cents}
                                costs={device.costs}
                                canViewPurchaseValue={isAdmin && canViewPurchaseValue}
                              />
                            ) : null}
                          </div>
                          <Select
                            value={entry.payment_method_id || '__none__'}
                            onValueChange={(v) => {
                              if (v === '__none__') {
                                setSellPaymentMethodAt(i, {
                                  payment_method_id: '',
                                  value_cents: null,
                                  installments: 1,
                                })
                                return
                              }
                              setSellPaymentMethodAt(i, {
                                payment_method_id: v,
                                installments: 1,
                              })
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nenhum</SelectItem>
                              {paymentMethods.map((pm) => (
                                <SelectItem key={pm.id} value={pm.id}>
                                  {pm.description}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-3 space-y-1">
                          <Label className="md:hidden">Valor</Label>
                          <Input
                            value={
                              entry.value_cents != null
                                ? maskedFromCents(entry.value_cents)
                                : ''
                            }
                            onChange={(e) => {
                              const raw = moneyToCentsFromMasked(
                                formatMoneyInput(e.target.value),
                              )
                              setSellPaymentMethodAt(i, { value_cents: raw })
                            }}
                            placeholder="0,00"
                            className="h-9"
                          />
                        </div>
                        {entry.payment_method_id &&
                          (() => {
                            const pm = paymentMethods.find(
                              (p) => p.id === entry.payment_method_id,
                            )
                            const isCredit = pm?.type === 'credito'
                            if (!isCredit) {
                              return <div className="hidden md:block md:col-span-2" aria-hidden />
                            }
                            const maxInstallments = pm?.credit_installment_fees
                              ?.length
                              ? Math.max(
                                ...pm.credit_installment_fees.map(
                                  (f) => f.installments,
                                ),
                              )
                              : 12
                            return (
                              <div className="md:col-span-2 space-y-1">
                                <Label className="md:hidden">Parcelas</Label>
                                <Select
                                  value={String(entry.installments || 1)}
                                  onValueChange={(v) =>
                                    setSellPaymentMethodAt(i, {
                                      installments: Number(v) || 1,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from(
                                      { length: maxInstallments },
                                      (_, n) => n + 1,
                                    ).map((n) => (
                                      <SelectItem key={n} value={String(n)}>
                                        {n}x
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )
                          })()}
                        <div className="md:col-span-1 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                            onClick={() => removeSellPaymentMethod(i)}
                            disabled={sellPaymentMethods.length <= 1}
                            aria-label="Remover forma de pagamento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSellPaymentMethod}
                    className="w-full border-dashed border-green-600 bg-green-600/5 text-green-700 hover:bg-green-600/10 hover:text-green-800"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Incluir forma de pagamento
                  </Button>
                  {(() => {
                    const sum = getSellPaymentsTotalCents()
                    const cashNet = getSellCashNetFromPaymentsCents()
                    const tradeIn = getSellTradeInTotalCents()
                    const net = getSellNetFromPaymentsCents()
                    if (net == null || net <= 0) return null
                    const tradeLines = getValidSellTradeInLines()
                    return (
                      <div className="text-sm text-muted-foreground pt-1 space-y-1">
                        {tradeLines.length > 0 ? (
                          <ul className="text-xs space-y-0.5">
                            {tradeLines.map((l) => (
                              <li key={l.rowKey}>
                                Troca: {l.deviceName.trim()} —{' '}
                                {formatCentsBr(l.valueCents ?? 0)}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <p>
                          Total líquido da venda:{' '}
                          <span className="text-green-600 font-medium">
                            {formatCentsBr(net)}
                          </span>
                          {sum != null &&
                          cashNet != null &&
                          sum > cashNet ? (
                            <>
                              {' — '}
                              Total a cobrar: {formatCentsBr(sum)}
                            </>
                          ) : null}
                          {tradeIn > 0 && cashNet != null && cashNet > 0 ? (
                            <span className="text-xs block text-muted-foreground">
                              (inclui {formatCentsBr(tradeIn)} em troca)
                            </span>
                          ) : null}
                        </p>
                      </div>
                    )
                  })()}
                </div>
                <ResaleSellAdminProfitCard
                  device={device}
                  sellPaymentMethods={sellPaymentMethods}
                  paymentMethods={paymentMethods}
                  isAdmin={isAdmin}
                  transactionTotalCents={getSellTransactionTotalCents()}
                  deviceSaleCents={getSellDeviceSaleCents()}
                  tradeInTotalCents={getSellTradeInTotalCents()}
                  addonLines={sellAddonItems}
                  addonCostTotalCents={getSellAddonCostTotalCents()}
                  commissionUserName={
                    teamUsers.find(
                      (u) => u.id === sellCommissionSnapshot.userId,
                    )?.full_name ||
                    teamUsers.find(
                      (u) => u.id === sellCommissionSnapshot.userId,
                    )?.email ||
                    null
                  }
                  commission={sellCommissionSnapshot}
                />
              </>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSavingSell}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmSell}
            disabled={(() => {
              const net = getSellNetFromPaymentsCents()
              const cashNet = getSellCashNetFromPaymentsCents()
              if (sellPaymentMethods.some((e) => e.payment_method_id?.trim())) {
                if (cashNet === null) return true
              }
              if (sellTradeInEnabled && getValidSellTradeInLines().length === 0) {
                return true
              }
              return isSavingSell || net === null || net <= 0
            })()}
          >
            {isSavingSell ? 'Salvando…' : 'Confirmar venda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
