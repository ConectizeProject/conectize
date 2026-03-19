'use client'

import { useCallback, useEffect, useState } from 'react'
import { useOrderServicesTotalSubscription } from './OrderServicesTotalContext'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { formatCentsBr, formatMoneyInputBr, parseMoneyToCents } from '@/lib/utils/format-money'
import { SELECT_NONE_VALUE } from '@/lib/utils/optional-uuid'

export type PaymentMethodEntry = {
  payment_method_id: string
  installments?: number
  value_cents?: number | null
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

type FormikProps = {
  values: { paymentMethods: PaymentMethodEntry[] }
  setFieldValue: (field: string, value: PaymentMethodEntry[]) => void
}

type Props = {
  /** Modo Formik: usa values e setFieldValue do formulário. */
  formik?: FormikProps
  /** Modo form nativo: valores iniciais e formId. */
  defaultValue?: PaymentMethodEntry[]
  formId?: string
  disabled?: boolean
  /** Total da ordem em centavos (para exibir resumo e validar soma). */
  totalValueCents?: number
}

function makeEntryId() {
  return `pm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const DEFAULT_EMPTY_ENTRY: PaymentMethodEntry = { payment_method_id: '', installments: 1, value_cents: null }

export function OrderPaymentMethodFields({
  formik,
  defaultValue = [],
  formId,
  disabled = false,
  totalValueCents: totalValueCentsProp,
}: Props) {
  const totalFromSubscription = useOrderServicesTotalSubscription()
  const totalValueCents = totalValueCentsProp ?? totalFromSubscription

  const [paymentMethodsCatalog, setPaymentMethodsCatalog] = useState<PaymentMethod[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [internalEntries, setInternalEntries] = useState<PaymentMethodEntry[]>(
    defaultValue.length > 0 ? defaultValue : [DEFAULT_EMPTY_ENTRY]
  )

  const isFormikMode = !!formik
  const entries = isFormikMode ? formik.values.paymentMethods : internalEntries

  // Garante sempre pelo menos uma forma de pagamento exibida
  useEffect(() => {
    if (entries.length === 0) {
      setEntries([DEFAULT_EMPTY_ENTRY])
    }
  }, [entries.length])

  // Sincroniza estado interno com defaultValue na montagem/atualização do valor inicial (edição da OS)
  const defaultLength = defaultValue?.length ?? 0
  useEffect(() => {
    if (isFormikMode) return
    if (defaultLength > 0) {
      setInternalEntries(defaultValue.map((e) => ({ ...e })))
    }
  }, [isFormikMode, defaultLength])

  const loadPaymentMethods = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await portalFetch('/api/portal/payment-methods')
      const data = await res?.json().catch(() => null)
      if (data?.ok && Array.isArray(data.paymentMethods)) {
        setPaymentMethodsCatalog(data.paymentMethods)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPaymentMethods()
  }, [loadPaymentMethods])

  function setEntries(next: PaymentMethodEntry[]) {
    if (isFormikMode) {
      formik!.setFieldValue('paymentMethods', next)
    } else {
      setInternalEntries(next)
    }
  }

  function addEntry() {
    setEntries([...entries, { ...DEFAULT_EMPTY_ENTRY }])
  }

  function removeEntry(index: number) {
    if (entries.length === 1) {
      setEntries([{ ...DEFAULT_EMPTY_ENTRY }])
    } else {
      setEntries(entries.filter((_, i) => i !== index))
    }
  }

  function updateEntry(index: number, field: 'payment_method_id' | 'installments' | 'value_cents', value: string | number | null) {
    const next = [...entries]
    if (field === 'payment_method_id') {
      next[index] = { ...next[index], payment_method_id: String(value), installments: 1 }
    } else if (field === 'installments') {
      next[index] = { ...next[index], installments: Number(value) || 1 }
    } else {
      next[index] = { ...next[index], value_cents: value === null || value === '' ? null : (typeof value === 'number' ? value : parseMoneyToCents(String(value))) }
    }
    setEntries(next)
  }

  const formAttr = formId ? { form: formId } : {}

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">Formas de pagamento</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addEntry}
          disabled={isLoading || disabled}
          aria-label="Adicionar forma de pagamento"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Adicionar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Ex.: dois cartões, parte PIX e parte cartão, etc.
      </p>

      <div className="space-y-3">
        {entries.map((entry, index) => {
          const entryMethodId = entry.payment_method_id ? String(entry.payment_method_id).trim() : ''
          const pm = paymentMethodsCatalog.find(
            (p) => String(p.id).toLowerCase() === entryMethodId.toLowerCase()
          )
          const isCredit = pm?.type === 'credito'
          const maxInstallments = pm?.credit_installment_fees?.length
            ? Math.max(...pm.credit_installment_fees.map((f) => f.installments))
            : 12
          const valueDisplay = entry.value_cents != null && entry.value_cents > 0
            ? formatMoneyInputBr(String(entry.value_cents))
            : ''

          return (
            <div
              key={index}
              className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3"
            >
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label className="text-xs">Forma {index + 1}</Label>
                <Select
                  value={pm ? String(pm.id) : (entryMethodId || '__none__')}
                  onValueChange={(v) => updateEntry(index, 'payment_method_id', v === '__none__' ? '' : v)}
                  disabled={isLoading || disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {paymentMethodsCatalog.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[120px] space-y-1.5">
                <Label className="text-xs">Valor</Label>
                <Input
                  value={valueDisplay}
                  onChange={(e) => {
                    const cents = parseMoneyToCents(formatMoneyInputBr(e.target.value))
                    updateEntry(index, 'value_cents', cents > 0 ? cents : null)
                  }}
                  inputMode="numeric"
                  placeholder="0,00"
                  disabled={disabled}
                />
              </div>
              {isCredit && (
                <div className="w-[100px] space-y-1.5">
                  <Label className="text-xs">Parcelas</Label>
                  <Select
                    value={String(entry.installments ?? 1)}
                    onValueChange={(v) => updateEntry(index, 'installments', parseInt(v, 10) || 1)}
                    disabled={disabled}
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
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeEntry(index)}
                disabled={disabled}
                aria-label={entries.length === 1 ? 'Limpar' : 'Remover'}
                className="h-10 w-10 shrink-0"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          )
        })}
      </div>

      {totalValueCents != null && totalValueCents > 0 && (
        <div className="text-sm text-muted-foreground">
          Total da ordem: {formatCentsBr(totalValueCents)}
          {(() => {
            const sum = entries
              .filter((e) => e.payment_method_id)
              .reduce((acc, e) => acc + (e.value_cents ?? 0), 0)
            if (sum > 0) {
              const diff = totalValueCents - sum
              return (
                <>
                  {' — '}Soma das formas: {formatCentsBr(sum)}
                  {diff !== 0 && (
                    <span className={diff > 0 ? 'text-amber-600' : 'text-destructive'}>
                      {' '}({diff > 0 ? '+' : ''}{formatCentsBr(Math.abs(diff))} de diferença)
                    </span>
                  )}
                </>
              )
            }
            return null
          })()}
        </div>
      )}

      {!isFormikMode && (
        <input
          type="hidden"
          name="paymentMethodsJson"
          value={JSON.stringify(
            entries.filter((e) => {
              const id = String(e.payment_method_id || '').trim()
              return Boolean(id) && id !== SELECT_NONE_VALUE
            }),
          )}
          {...formAttr}
        />
      )}
    </div>
  )
}
