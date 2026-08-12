'use client'

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import { formatCentsBr } from '@/lib/utils/format-money'
import {
  commissionFromPercentOfGrossCents,
  grossProfitBeforeCommissionCents,
  paymentFeeCentsForSaleEntries,
} from '@/lib/resale/resale-commission'
import { isSaleDerivedCostDescription } from '@/lib/resale/resale-sale-costs'

export type SellCommissionInitial = {
  enabled: boolean
  userId: string
  kind: 'percent' | 'fixed'
  percentRaw: string
  fixedMasked: string
}

export type SellCommissionSnapshot = SellCommissionInitial

export type ResaleSellCommissionPanelRef = {
  getValues: () => SellCommissionSnapshot
}

type TeamUser = { id: string; email: string | null; full_name: string | null; role: string }

type SalePaymentEntry = {
  payment_method_id: string
  value_cents: number | null
  installments: number
}

type PaymentMethod = {
  id: string
  description: string
  type: string
  fee_percent: number
  credit_installment_fees: Array<{ installments: number; fee_percent: number }>
}

type DeviceSlice = {
  purchase_value_cents: number | null
  costs: Array<{ description: string | null; value_cents: number }>
}

type AddonLine = {
  name: string
  quantity: number
  unitSaleCents: number
  unitCostCents: number
}

type CommissionFieldsProps = {
  device: DeviceSlice
  sellPaymentMethods: SalePaymentEntry[]
  paymentMethods: PaymentMethod[]
  teamUsers: TeamUser[]
  initial: SellCommissionInitial
  addonCostTotalCents: number
  tradeInTotalCents?: number
  onSnapshotChange?: (s: SellCommissionSnapshot) => void
}

export const ResaleSellCommissionFields = forwardRef<
ResaleSellCommissionPanelRef,
CommissionFieldsProps
>(
  function ResaleSellCommissionFields (
    {
      device,
      sellPaymentMethods,
      paymentMethods,
      teamUsers,
      initial,
      addonCostTotalCents,
      tradeInTotalCents = 0,
      onSnapshotChange,
    },
    ref,
  ) {
    const [enabled, setEnabled] = useState(initial.enabled)
    const [userId, setUserId] = useState(initial.userId)
    const [kind, setKind] = useState<'percent' | 'fixed'>(initial.kind)
    const [percentRaw, setPercentRaw] = useState(initial.percentRaw)
    const [fixedMasked, setFixedMasked] = useState(initial.fixedMasked)

    useImperativeHandle(ref, () => ({
      getValues: () => ({
        enabled,
        userId: userId.trim(),
        kind,
        percentRaw,
        fixedMasked,
      }),
    }), [enabled, userId, kind, percentRaw, fixedMasked])

    useEffect(() => {
      onSnapshotChange?.({
        enabled,
        userId: userId.trim(),
        kind,
        percentRaw,
        fixedMasked,
      })
    }, [enabled, userId, kind, percentRaw, fixedMasked, onSnapshotChange])

    const deviceOperationalCents = useMemo(
      () => (device.costs || []).reduce(
        (acc, c) => acc + (isSaleDerivedCostDescription(c.description) ? 0 : (c.value_cents ?? 0)),
        0,
      ),
      [device.costs],
    )

    const baseOperationalWithAddonsCents = deviceOperationalCents + addonCostTotalCents

    const percentHint = useMemo(() => {
      if (kind !== 'percent') return null
      const p = Number.parseFloat(percentRaw.replace(',', '.'))
      if (!Number.isFinite(p) || p <= 0) return null
      const valid = sellPaymentMethods.filter((e) => e.payment_method_id?.trim())
      let sum = 0
      for (const e of valid) {
        const v = e.value_cents
        if (v == null || v <= 0) return null
        sum += v
      }
      if (sum + tradeInTotalCents <= 0) return null
      const purchaseCents = device.purchase_value_cents ?? 0
      const fee = paymentFeeCentsForSaleEntries(valid, paymentMethods)
      const gross = grossProfitBeforeCommissionCents(
        sum,
        purchaseCents,
        baseOperationalWithAddonsCents,
        fee,
        tradeInTotalCents,
      )
      const commissionCents = commissionFromPercentOfGrossCents(gross, p)
      return { commissionCents, grossCents: gross }
    }, [
      kind,
      percentRaw,
      sellPaymentMethods,
      device.purchase_value_cents,
      paymentMethods,
      baseOperationalWithAddonsCents,
      tradeInTotalCents,
    ])

    return (
      <div className="space-y-3 rounded-md border p-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="sell-commission"
            checked={enabled}
            onCheckedChange={(v) => setEnabled(v === true)}
          />
          <Label htmlFor="sell-commission" className="font-normal cursor-pointer leading-snug">
            Comissão
          </Label>
        </div>
        {enabled ? (
          <div className="grid gap-3 sm:grid-cols-2 pl-6 border-t pt-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Colaborador</Label>
              <Select
                value={userId || '__none__'}
                onValueChange={(v) => setUserId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione…</SelectItem>
                  {teamUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {(u.full_name || '').trim() || u.email || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs">Tipo de comissão</Label>
              <RadioGroup
                value={kind}
                onValueChange={(v: 'percent' | 'fixed') => setKind(v)}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="comm-fix" />
                  <Label htmlFor="comm-fix" className="font-normal cursor-pointer">
                    Valor fixo (R$)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="percent" id="comm-pct" />
                  <Label htmlFor="comm-pct" className="font-normal cursor-pointer">
                    Percentual sobre o lucro bruto
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-1 sm:col-span-2">
              {kind === 'fixed' ? (
                <>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input
                    value={fixedMasked}
                    onChange={(e) => setFixedMasked(formatMoneyInput(e.target.value))}
                    placeholder="0,00"
                    className="h-9"
                  />
                </>
              ) : (
                <>
                  <Label className="text-xs">Percentual sobre o lucro bruto (%)</Label>
                  <Input
                    value={percentRaw}
                    onChange={(e) => setPercentRaw(e.target.value.replace(/[^0-9,.-]/g, ''))}
                    placeholder="Ex: 2,5"
                    className="h-9"
                  />
                  {percentHint ? (
                    <div className="pt-0.5 space-y-0.5">
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Comissão: R$ {maskedFromCents(percentHint.commissionCents)}
                      </p>
                      {percentHint.grossCents <= 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Lucro bruto (venda + troca − compra − custos − taxa) não é positivo; comissão percentual = R$ 0,00.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    )
  },
)

type ProfitCardProps = {
  device: DeviceSlice
  sellPaymentMethods: SalePaymentEntry[]
  paymentMethods: PaymentMethod[]
  isAdmin: boolean
  transactionTotalCents: number | null
  deviceSaleCents: number | null
  tradeInTotalCents?: number
  addonLines: AddonLine[]
  addonCostTotalCents: number
  commission: SellCommissionSnapshot
  commissionUserName?: string | null
}

export function ResaleSellAdminProfitCard ({
  device,
  sellPaymentMethods,
  paymentMethods,
  isAdmin,
  transactionTotalCents,
  deviceSaleCents,
  tradeInTotalCents = 0,
  addonLines,
  addonCostTotalCents,
  commission,
  commissionUserName = null,
}: ProfitCardProps) {
  const {
    enabled,
    userId,
    kind,
    percentRaw,
    fixedMasked,
  } = commission

  const deviceOperationalCents = useMemo(
    () => (device.costs || []).reduce(
      (acc, c) => acc + (isSaleDerivedCostDescription(c.description) ? 0 : (c.value_cents ?? 0)),
      0,
    ),
    [device.costs],
  )

  const baseOperationalWithAddonsCents = deviceOperationalCents + addonCostTotalCents

  const adminBreakdown = useMemo(() => {
    if (!isAdmin) return null
    const validPreview = sellPaymentMethods.filter((e) => e.payment_method_id?.trim())
    let paymentSum = 0
    let hasPaymentSum = true
    for (const e of validPreview) {
      const v = e.value_cents
      if (v == null || v <= 0) {
        hasPaymentSum = false
        break
      }
      paymentSum += v
    }
    if (validPreview.length === 0) hasPaymentSum = false

    const purchaseCents = device.purchase_value_cents ?? 0
    const feeRows = validPreview.map((entry, idx) => {
      const pm = paymentMethods.find((p) => p.id === entry.payment_method_id)
      const amountCents = entry.value_cents ?? 0
      if (!pm || amountCents <= 0) {
        return {
          key: `fee-${idx}`,
          label: `Taxa método de pagamento ${idx + 1}`,
          valueCents: 0,
        }
      }
      let feePercent = Number(pm.fee_percent) || 0
      if (pm.type === 'credito' && Array.isArray(pm.credit_installment_fees) && pm.credit_installment_fees.length > 0) {
        const byInstallments = pm.credit_installment_fees.find(
          (f) => Number(f.installments) === Number(entry.installments || 1),
        )
        if (byInstallments && byInstallments.fee_percent != null) {
          feePercent = Number(byInstallments.fee_percent) || 0
        }
      }
      const feeCents = feePercent > 0 ? Math.floor((amountCents * feePercent) / 100) : 0
      return {
        key: `fee-${idx}`,
        label: `Taxa ${pm.description || `método ${idx + 1}`}`,
        valueCents: feeCents,
      }
    }).filter((r) => r.valueCents > 0)
    const paymentFeePreviewCents = feeRows.reduce((acc, r) => acc + r.valueCents, 0)

    let commPreview = 0
    if (hasPaymentSum && enabled && userId.trim()) {
      if (kind === 'percent') {
        const p = Number.parseFloat(percentRaw.replace(',', '.'))
        const gross = grossProfitBeforeCommissionCents(
          paymentSum,
          purchaseCents,
          baseOperationalWithAddonsCents,
          paymentFeePreviewCents,
          tradeInTotalCents,
        )
        commPreview = Number.isFinite(p) && p > 0 ? commissionFromPercentOfGrossCents(gross, p) : 0
      } else {
        commPreview = moneyToCentsFromMasked(fixedMasked) ?? 0
      }
    }

    const deviceCostRows = (device.costs || []).filter(
      (c) => !isSaleDerivedCostDescription(c.description),
    )

    const receita = transactionTotalCents
    const totalCosts =
      purchaseCents
      + deviceOperationalCents
      + addonCostTotalCents
      + paymentFeePreviewCents
      + (enabled && userId.trim() ? commPreview : 0)

    const lucroCents = receita != null && receita > 0 ? receita - totalCosts : null

    return {
      validPreview,
      hasPaymentSum,
      paymentSum,
      purchaseCents,
      deviceOperationalCents,
      deviceCostRows,
      paymentFeePreviewCents,
      feeRows,
      commPreview,
      receita,
      totalCosts,
      lucroCents,
    }
  }, [
    isAdmin,
    sellPaymentMethods,
    device.purchase_value_cents,
    device.costs,
    paymentMethods,
    enabled,
    userId,
    kind,
    percentRaw,
    fixedMasked,
    baseOperationalWithAddonsCents,
    deviceOperationalCents,
    addonCostTotalCents,
    transactionTotalCents,
    tradeInTotalCents,
  ])

  if (!isAdmin || !adminBreakdown) return null

  return (
    <div className="rounded-lg border bg-muted/40 px-4 py-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">Total da operação</p>
      {adminBreakdown.receita != null && adminBreakdown.receita > 0 ? (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">+ Aparelho</span>
            <span className="tabular-nums font-medium text-green-700 dark:text-green-400">
              {deviceSaleCents != null && deviceSaleCents > 0
                ? formatCentsBr(deviceSaleCents)
                : '—'}
            </span>
          </div>
          {addonLines.length > 0 ? (
            <div className="space-y-1">
              {addonLines.map((line, idx) => (
                <div
                  key={`${line.name}-${idx}`}
                  className="flex justify-between gap-4 text-xs"
                >
                  <span className="text-muted-foreground truncate pr-2 text-sm">
                    + {line.name}
                  </span>
                  <span className="tabular-nums shrink-0 text-sm text-green-700 dark:text-green-400">
                    {formatCentsBr(line.quantity * line.unitSaleCents)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {tradeInTotalCents > 0 ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">+ Troca(s)</span>
              <span className="tabular-nums font-medium text-green-700 dark:text-green-400">
                {formatCentsBr(tradeInTotalCents)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">- Custo aparelho</span>
            <span className="tabular-nums text-red-700 dark:text-red-400">
              {formatCentsBr(adminBreakdown.purchaseCents)}
            </span>
          </div>
          {addonLines.length > 0 ? (
            <div className="space-y-1">
              {addonLines.map((line, idx) => (
                <div key={`cost-addon-${idx}`} className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground truncate pr-2">- Custo {line.name}</span>
                  <span className="tabular-nums text-red-700 dark:text-red-400">
                    {formatCentsBr(line.quantity * line.unitCostCents)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {adminBreakdown.deviceCostRows.length > 0 ? (
            <div className="space-y-1">
              {adminBreakdown.deviceCostRows.map((c, i) => (
                <div key={`dc-${i}-${c.description ?? ''}`} className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground truncate pr-2">- {c.description || 'Custo'}</span>
                  <span className="tabular-nums text-red-700 dark:text-red-400">
                    {formatCentsBr(c.value_cents ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {adminBreakdown.feeRows.length > 0 ? (
            <div className="space-y-1">
              {adminBreakdown.feeRows.map((row) => (
                <div key={row.key} className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground truncate pr-2">- {row.label}</span>
                  <span className="tabular-nums text-red-700 dark:text-red-400">
                    {formatCentsBr(row.valueCents)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">- Taxa forma de pagamento</span>
              <span className="tabular-nums text-red-700 dark:text-red-400">
                {formatCentsBr(adminBreakdown.paymentFeePreviewCents)}
              </span>
            </div>
          )}
          {enabled && userId.trim() ? (
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                - Comissão {commissionUserName?.trim() || ''}
              </span>
              <span className="tabular-nums text-red-700 dark:text-red-400">
                {formatCentsBr(adminBreakdown.commPreview)}
              </span>
            </div>
          ) : null}
          <div className="border-t border-border/80 pt-2" />
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Lucro
            </p>
            <p
              className={`text-2xl font-bold tabular-nums ${
                adminBreakdown.lucroCents != null
                  ? adminBreakdown.lucroCents >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                  : ''
              }`}
            >
              {adminBreakdown.lucroCents != null ? formatCentsBr(adminBreakdown.lucroCents) : '—'}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Informe o valor do aparelho e as formas de pagamento para ver o cálculo.
        </p>
      )}
    </div>
  )
}
