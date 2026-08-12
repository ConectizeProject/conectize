'use client'

import { useEffect, useMemo, useState } from 'react'
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
import {
  EMPTY_ORDER_DISCOUNT_COMMISSION,
  resolveOrderDiscountCents,
  type OrderCommissionKind,
  type OrderDiscountCommissionValues,
  type OrderDiscountMode,
} from '@/lib/orders/order-discount-commission'
import { formatCentsBr } from '@/lib/utils/format-money'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import { useOrderServicesTotalSubscription } from './OrderServicesTotalContext'

export type OrderTeamUserOption = {
  id: string
  full_name: string | null
  email: string | null
}

type FormikDiscountCommission = {
  values: OrderDiscountCommissionValues
  setFieldValue: (field: string, value: unknown) => void
}

type Props = {
  formik?: FormikDiscountCommission
  defaultValue?: OrderDiscountCommissionValues
  formId?: string
  disabled?: boolean
  teamUsers?: OrderTeamUserOption[]
  onDiscountCentsChange?: (discountCents: number) => void
}

const inputGroupShell =
  'flex h-9 w-full overflow-hidden rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'

function DiscountField ({
  value,
  onChange,
  mode,
  onModeToggle,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  mode: OrderDiscountMode
  onModeToggle: () => void
  disabled?: boolean
}) {
  return (
    <div className={inputGroupShell} role="group" aria-label="Desconto">
      <input
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(
          mode === 'percent'
            ? e.target.value.replace(/[^\d,]/g, '')
            : formatMoneyInput(e.target.value),
        )}
        placeholder={mode === 'percent' ? '0' : '0,00'}
        className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={onModeToggle}
        className="flex w-9 shrink-0 items-center justify-center border-l border-input bg-primary text-xs font-medium text-primary-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mode === 'fixed' ? 'R$' : '%'}
      </button>
    </div>
  )
}

function teamUserLabel (u: OrderTeamUserOption) {
  return (u.full_name || '').trim() || u.email || u.id
}

function maskFromDiscountValues (v: OrderDiscountCommissionValues) {
  if (v.discountMode === 'percent') {
    return v.discountPercent > 0 ? String(v.discountPercent).replace('.', ',') : ''
  }
  return v.discountFixedCents > 0 ? maskedFromCents(v.discountFixedCents) : ''
}

export function OrderPaymentDiscountCommissionFields ({
  formik,
  defaultValue = EMPTY_ORDER_DISCOUNT_COMMISSION,
  formId,
  disabled = false,
  teamUsers = [],
  onDiscountCentsChange,
}: Props) {
  const servicesTotalCents = useOrderServicesTotalSubscription()
  const isFormikMode = Boolean(formik)
  const seed = isFormikMode && formik ? formik.values : defaultValue

  const [internal, setInternal] = useState<OrderDiscountCommissionValues>(seed)
  const [discountMasked, setDiscountMasked] = useState(() => maskFromDiscountValues(seed))
  const [commissionFixedMasked, setCommissionFixedMasked] = useState(() =>
    seed.commissionFixedCents > 0 ? maskedFromCents(seed.commissionFixedCents) : '',
  )
  const [commissionPercentRaw, setCommissionPercentRaw] = useState(() =>
    seed.commissionPercent > 0 ? String(seed.commissionPercent).replace('.', ',') : '',
  )

  const values = isFormikMode ? formik!.values : internal

  useEffect(() => {
    if (isFormikMode) return
    const next: OrderDiscountCommissionValues = {
      discountMode: defaultValue.discountMode,
      discountFixedCents: defaultValue.discountFixedCents,
      discountPercent: defaultValue.discountPercent,
      commissionEnabled: defaultValue.commissionEnabled,
      commissionUserId: defaultValue.commissionUserId,
      commissionKind: defaultValue.commissionKind,
      commissionFixedCents: defaultValue.commissionFixedCents,
      commissionPercent: defaultValue.commissionPercent,
    }
    setInternal(next)
    setDiscountMasked(maskFromDiscountValues(next))
    setCommissionFixedMasked(
      next.commissionFixedCents > 0 ? maskedFromCents(next.commissionFixedCents) : '',
    )
    setCommissionPercentRaw(
      next.commissionPercent > 0 ? String(next.commissionPercent).replace('.', ',') : '',
    )
  }, [
    isFormikMode,
    defaultValue.discountMode,
    defaultValue.discountFixedCents,
    defaultValue.discountPercent,
    defaultValue.commissionEnabled,
    defaultValue.commissionUserId,
    defaultValue.commissionKind,
    defaultValue.commissionFixedCents,
    defaultValue.commissionPercent,
  ])

  function patch (partial: Partial<OrderDiscountCommissionValues>) {
    if (isFormikMode) {
      for (const [key, value] of Object.entries(partial)) {
        formik!.setFieldValue(key, value)
      }
      return
    }
    setInternal((prev) => ({ ...prev, ...partial }))
  }

  const discountCents = useMemo(
    () => resolveOrderDiscountCents(
      servicesTotalCents,
      values.discountMode,
      values.discountFixedCents,
      values.discountPercent,
    ),
    [
      servicesTotalCents,
      values.discountMode,
      values.discountFixedCents,
      values.discountPercent,
    ],
  )

  useEffect(() => {
    onDiscountCentsChange?.(discountCents)
  }, [discountCents, onDiscountCentsChange])

  const formAttr = formId ? { form: formId } : {}

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Desconto</Label>
          <DiscountField
            value={discountMasked}
            onChange={(raw) => {
              setDiscountMasked(raw)
              if (values.discountMode === 'percent') {
                const pct = Math.min(100, Math.max(0, Number(raw.replace(',', '.')) || 0))
                patch({ discountPercent: pct, discountFixedCents: 0 })
              } else {
                patch({
                  discountFixedCents: moneyToCentsFromMasked(raw) || 0,
                  discountPercent: 0,
                })
              }
            }}
            mode={values.discountMode}
            onModeToggle={() => {
              const next: OrderDiscountMode =
                values.discountMode === 'fixed' ? 'percent' : 'fixed'
              setDiscountMasked('')
              patch({
                discountMode: next,
                discountFixedCents: 0,
                discountPercent: 0,
              })
            }}
            disabled={disabled}
          />
          {discountCents > 0 ? (
            <p className="text-xs text-muted-foreground">
              Desconto aplicado: {formatCentsBr(discountCents)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="order-commission-enabled"
            checked={values.commissionEnabled}
            onCheckedChange={(v) => patch({ commissionEnabled: v === true })}
            disabled={disabled}
          />
          <Label
            htmlFor="order-commission-enabled"
            className="font-normal cursor-pointer leading-snug"
          >
            Comissão
          </Label>
        </div>

        {values.commissionEnabled ? (
          <div className="grid gap-3 sm:grid-cols-2 pl-6 border-t pt-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Colaborador</Label>
              <Select
                value={values.commissionUserId || '__none__'}
                onValueChange={(v) =>
                  patch({ commissionUserId: v === '__none__' ? '' : v })
                }
                disabled={disabled}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione…</SelectItem>
                  {teamUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {teamUserLabel(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs">Tipo de comissão</Label>
              <RadioGroup
                value={values.commissionKind}
                onValueChange={(v: OrderCommissionKind) => patch({ commissionKind: v })}
                className="flex flex-wrap gap-4"
                disabled={disabled}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="order-comm-fixed" disabled={disabled} />
                  <Label htmlFor="order-comm-fixed" className="font-normal cursor-pointer">
                    Valor fixo (R$)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="percent" id="order-comm-pct" disabled={disabled} />
                  <Label htmlFor="order-comm-pct" className="font-normal cursor-pointer">
                    Percentual sobre o líquido recebido
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-1 sm:col-span-2">
              {values.commissionKind === 'fixed' ? (
                <>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input
                    value={commissionFixedMasked}
                    onChange={(e) => {
                      const masked = formatMoneyInput(e.target.value)
                      setCommissionFixedMasked(masked)
                      patch({ commissionFixedCents: moneyToCentsFromMasked(masked) || 0 })
                    }}
                    placeholder="0,00"
                    className="h-9"
                    disabled={disabled}
                  />
                </>
              ) : (
                <>
                  <Label className="text-xs">Percentual sobre o líquido recebido (%)</Label>
                  <Input
                    value={commissionPercentRaw}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9,.-]/g, '')
                      setCommissionPercentRaw(raw)
                      const pct = Math.min(100, Math.max(0, Number(raw.replace(',', '.')) || 0))
                      patch({ commissionPercent: pct })
                    }}
                    placeholder="Ex: 10"
                    className="h-9"
                    disabled={disabled}
                  />
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {!isFormikMode ? (
        <>
          <input type="hidden" name="discountMode" value={values.discountMode} {...formAttr} />
          <input
            type="hidden"
            name="discountFixedCents"
            value={String(values.discountFixedCents)}
            {...formAttr}
          />
          <input
            type="hidden"
            name="discountPercent"
            value={String(values.discountPercent)}
            {...formAttr}
          />
          <input
            type="hidden"
            name="commissionEnabled"
            value={values.commissionEnabled ? '1' : ''}
            {...formAttr}
          />
          <input
            type="hidden"
            name="commissionUserId"
            value={values.commissionUserId}
            {...formAttr}
          />
          <input
            type="hidden"
            name="commissionKind"
            value={values.commissionKind}
            {...formAttr}
          />
          <input
            type="hidden"
            name="commissionFixedCents"
            value={String(values.commissionFixedCents)}
            {...formAttr}
          />
          <input
            type="hidden"
            name="commissionPercent"
            value={String(values.commissionPercent)}
            {...formAttr}
          />
        </>
      ) : null}
    </div>
  )
}
