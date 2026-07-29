'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { useOrderServicesTotalSubscription } from './OrderServicesTotalContext'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PortalPaymentMethodCatalogItem } from '@/lib/portal/payment-methods-server'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { resolveOrderPayableCents } from '@/lib/orders/order-discount-commission'
import { formatCentsBr, formatMoneyInputBr, parseMoneyToCents } from '@/lib/utils/format-money'
import { cn } from '@/lib/utils'
import { SELECT_NONE_VALUE } from '@/lib/utils/optional-uuid'

export type PaymentMethodEntry = {
  payment_method_id: string
  installments?: number
  value_cents?: number | null
}

export type OrderPaymentMethodFieldsRef = {
  addEntry: () => void
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
  /** Desconto em centavos (reduz o total a pagar exibido). */
  discountCents?: number
  /** Catálogo já carregado no servidor (RSC); se definido, não há fetch no cliente. */
  initialCatalog?: PortalPaymentMethodCatalogItem[]
  /** Para desabilitar o botão “Adicionar” no header enquanto o catálogo carrega. */
  onCatalogLoadingChange?: (loading: boolean) => void
}

const DEFAULT_EMPTY_ENTRY: PaymentMethodEntry = { payment_method_id: '', installments: 1, value_cents: null }

export const OrderPaymentMethodFields = forwardRef<OrderPaymentMethodFieldsRef, Props>(
  function OrderPaymentMethodFields(
    {
      formik,
      defaultValue = [],
      formId,
      disabled = false,
      totalValueCents: totalValueCentsProp,
      discountCents = 0,
      initialCatalog,
      onCatalogLoadingChange,
    },
    ref,
  ) {
    const totalFromSubscription = useOrderServicesTotalSubscription()
    const totalValueCents = totalValueCentsProp ?? totalFromSubscription
    const payableCents = resolveOrderPayableCents(totalValueCents ?? 0, discountCents)

    const [paymentMethodsCatalog, setPaymentMethodsCatalog] = useState<
      PortalPaymentMethodCatalogItem[]
    >(() => (initialCatalog !== undefined ? initialCatalog : []))
    const [isLoading, setIsLoading] = useState(() => initialCatalog === undefined)
    const [internalEntries, setInternalEntries] = useState<PaymentMethodEntry[]>(
      defaultValue.length > 0 ? defaultValue : [DEFAULT_EMPTY_ENTRY],
    )

    const isFormikMode = !!formik
    const entries = isFormikMode ? formik!.values.paymentMethods : internalEntries

    const formikRef = useRef(formik)
    if (isFormikMode) {
      formikRef.current = formik
    }

    useEffect(() => {
      if (!onCatalogLoadingChange) return
      let cancelled = false
      queueMicrotask(() => {
        if (!cancelled) onCatalogLoadingChange(isLoading)
      })
      return () => {
        cancelled = true
      }
    }, [isLoading, onCatalogLoadingChange])

    // Garante sempre pelo menos uma forma de pagamento exibida
    useEffect(() => {
      if (entries.length !== 0) return
      if (isFormikMode) {
        formik!.setFieldValue('paymentMethods', [DEFAULT_EMPTY_ENTRY])
      } else {
        setInternalEntries([DEFAULT_EMPTY_ENTRY])
      }
    }, [entries.length, isFormikMode, formik])

    // Sincroniza estado interno com defaultValue na montagem/atualização do valor inicial (edição da OS)
    const defaultLength = defaultValue?.length ?? 0
    useEffect(() => {
      if (isFormikMode) return
      if (defaultLength > 0) {
        setInternalEntries(defaultValue.map((e) => ({ ...e })))
      }
    }, [isFormikMode, defaultLength, defaultValue])

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
      if (initialCatalog !== undefined) return
      loadPaymentMethods()
    }, [initialCatalog, loadPaymentMethods])

    function setEntries(next: PaymentMethodEntry[]) {
      if (isFormikMode) {
        formik!.setFieldValue('paymentMethods', next)
      } else {
        setInternalEntries(next)
      }
    }

    useImperativeHandle(
      ref,
      () => ({
        addEntry: () => {
          if (isFormikMode) {
            const f = formikRef.current
            if (!f) return
            const cur = Array.isArray(f.values.paymentMethods) ? f.values.paymentMethods : []
            f.setFieldValue('paymentMethods', [...cur, { ...DEFAULT_EMPTY_ENTRY }])
            return
          }
          setInternalEntries((prev) => [...prev, { ...DEFAULT_EMPTY_ENTRY }])
        },
      }),
      [isFormikMode],
    )

    function removeEntry(index: number) {
      if (entries.length === 1) {
        setEntries([{ ...DEFAULT_EMPTY_ENTRY }])
      } else {
        setEntries(entries.filter((_, i) => i !== index))
      }
    }

    function updateEntry(
      index: number,
      field: 'payment_method_id' | 'installments' | 'value_cents',
      value: string | number | null,
    ) {
      const next = [...entries]
      if (field === 'payment_method_id') {
        next[index] = { ...next[index], payment_method_id: String(value), installments: 1 }
      } else if (field === 'installments') {
        next[index] = { ...next[index], installments: Number(value) || 1 }
      } else {
        next[index] = {
          ...next[index],
          value_cents:
            value === null || value === ''
              ? null
              : typeof value === 'number'
                ? value
                : parseMoneyToCents(String(value)),
        }
      }
      setEntries(next)
    }

    const formAttr = formId ? { form: formId } : {}

    return (
      <div className="space-y-3">
        <div className="space-y-3">
          <div className="hidden md:grid md:grid-cols-12 md:gap-3 text-xs font-medium text-muted-foreground px-1">
            <div className="md:col-span-6">Forma de pagamento</div>
            <div className="md:col-span-2">Valor</div>
            <div className="md:col-span-3">Parcelas</div>
            <div className="md:col-span-1 text-right">Ações</div>
          </div>
          {entries.map((entry, index) => {
            const entryMethodId = entry.payment_method_id ? String(entry.payment_method_id).trim() : ''
            const pm = paymentMethodsCatalog.find(
              (p) => String(p.id).toLowerCase() === entryMethodId.toLowerCase(),
            )
            const isCredit = pm?.type === 'credito'
            const maxInstallments = pm?.credit_installment_fees?.length
              ? Math.max(...pm.credit_installment_fees.map((f) => f.installments))
              : 12
            const valueDisplay =
              entry.value_cents != null && entry.value_cents > 0
                ? formatMoneyInputBr(String(entry.value_cents))
                : ''

            return (
              <div key={index} className="grid gap-3 md:grid-cols-12 items-end">
                <div className="md:col-span-6 space-y-1">
                  <Label htmlFor={`payment-method-${index}`} className="md:hidden">
                    Forma de pagamento
                  </Label>
                  <Select
                    value={pm ? String(pm.id) : entryMethodId || '__none__'}
                    onValueChange={(v) => updateEntry(index, 'payment_method_id', v === '__none__' ? '' : v)}
                    disabled={isLoading || disabled}
                  >
                    <SelectTrigger id={`payment-method-${index}`} className="w-full">
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
                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor={`payment-value-${index}`} className="md:hidden">
                    Valor
                  </Label>
                  <Input
                    id={`payment-value-${index}`}
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
                <div
                  className={cn(
                    'md:col-span-3 space-y-1',
                    !isCredit && 'hidden md:block',
                  )}
                >
                  {isCredit ? (
                    <>
                      <Label htmlFor={`payment-installments-${index}`} className="md:hidden">
                        Parcelas
                      </Label>
                      <Select
                        value={String(entry.installments ?? 1)}
                        onValueChange={(v) => updateEntry(index, 'installments', parseInt(v, 10) || 1)}
                        disabled={disabled}
                      >
                        <SelectTrigger id={`payment-installments-${index}`} className="w-full">
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
                    </>
                  ) : (
                    <div className="hidden md:block" aria-hidden>
                      <Skeleton className="h-10 w-full" />
                    </div>
                  )}
                </div>
                <div className="md:col-span-1 flex justify-end">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEntry(index)}
                      disabled={disabled}
                      title={entries.length === 1 ? 'Limpar forma de pagamento' : 'Remover forma de pagamento'}
                      aria-label={entries.length === 1 ? 'Limpar forma de pagamento' : 'Remover forma de pagamento'}
                      className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {index !== entries.length - 1 ? <div className="md:col-span-12 border-t" /> : null}
              </div>
            )
          })}
        </div>

        {totalValueCents != null && totalValueCents > 0 && (
          <div className="text-sm text-muted-foreground space-y-0.5">
            <div>
              Total da ordem: {formatCentsBr(totalValueCents)}
              {discountCents > 0 ? (
                <>
                  {' — '}Desconto: {formatCentsBr(discountCents)}
                  {' — '}A pagar: {formatCentsBr(payableCents)}
                </>
              ) : null}
            </div>
            {(() => {
              const sum = entries
                .filter((e) => e.payment_method_id)
                .reduce((acc, e) => acc + (e.value_cents ?? 0), 0)
              if (sum > 0) {
                const diff = payableCents - sum
                return (
                  <div>
                    Soma das formas: {formatCentsBr(sum)}
                    {diff !== 0 && (
                      <span className={diff > 0 ? 'text-amber-600' : 'text-destructive'}>
                        {' '}
                        ({diff > 0 ? '+' : ''}
                        {formatCentsBr(Math.abs(diff))} de diferença)
                      </span>
                    )}
                  </div>
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
  },
)
