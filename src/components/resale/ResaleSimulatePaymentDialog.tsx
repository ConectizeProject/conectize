'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { computeSimulatePaymentResult } from '@/lib/resale/simulate-single-payment'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'

export type ResaleSimulatePaymentMethod = {
  id: string
  description: string
  type: string
  fee_percent: number
  credit_installment_fees?: { installments: number; fee_percent: number }[] | null
}

export type ResaleSimulatePaymentDevice = {
  sale_value_cents: number | null
  wholesale_value_cents: number | null
}

type Props = {
  device: ResaleSimulatePaymentDevice | null
  paymentMethods: ResaleSimulatePaymentMethod[]
  onClose: () => void
}

function centsToReaisLabel (cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return maskedFromCents(cents)
}

export function ResaleSimulatePaymentDialog ({
  device,
  paymentMethods,
  onClose,
}: Props) {
  const open = Boolean(device)
  const [simulateValueSource, setSimulateValueSource] = useState<
    'varejo' | 'atacado' | 'custom'
  >('varejo')
  const [simulateValue, setSimulateValue] = useState('')
  const [simulatePaymentMethodId, setSimulatePaymentMethodId] = useState('')
  const [simulateInstallments, setSimulateInstallments] = useState(1)

  useEffect(() => {
    if (!device) return
    setSimulatePaymentMethodId('')
    setSimulateInstallments(1)
    const varejo = device.sale_value_cents ?? null
    const atacado = device.wholesale_value_cents ?? null
    const source =
      varejo != null ? 'varejo' : atacado != null ? 'atacado' : 'custom'
    setSimulateValueSource(source)
    setSimulateValue(
      varejo != null
        ? centsToReaisLabel(varejo)
        : atacado != null
          ? centsToReaisLabel(atacado)
          : '',
    )
  }, [device])

  function getSimulateBaseValueCents (): number | null {
    if (!device) return null
    if (simulateValueSource === 'varejo' && device.sale_value_cents != null) {
      return device.sale_value_cents
    }
    if (simulateValueSource === 'atacado' && device.wholesale_value_cents != null) {
      return device.wholesale_value_cents
    }
    return moneyToCentsFromMasked(simulateValue)
  }

  function getSimulateResult () {
    const receiveCents = getSimulateBaseValueCents()
    if (receiveCents == null || receiveCents <= 0) return null
    const pm = paymentMethods.find((p) => p.id === simulatePaymentMethodId)
    if (!pm) return null
    return computeSimulatePaymentResult(
      receiveCents,
      pm,
      simulateInstallments,
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Simular pagamento</DialogTitle>
          <DialogDescription>
            Informe o valor que deseja receber e a forma de pagamento. A taxa é
            descontada do valor cobrado ao cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {device ? (
            <>
              <div className="space-y-3">
                <Label>Valor a receber</Label>
                <RadioGroup
                  value={simulateValueSource}
                  onValueChange={(v: 'varejo' | 'atacado' | 'custom') => {
                    setSimulateValueSource(v)
                    if (!device) return
                    if (v === 'varejo' && device.sale_value_cents != null) {
                      setSimulateValue(centsToReaisLabel(device.sale_value_cents))
                    } else if (
                      v === 'atacado' &&
                      device.wholesale_value_cents != null
                    ) {
                      setSimulateValue(centsToReaisLabel(device.wholesale_value_cents))
                    } else if (v === 'custom') {
                      setSimulateValue('')
                    }
                  }}
                  className="flex flex-col gap-2"
                >
                  {device.sale_value_cents != null ? (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="varejo" id="sim-varejo-r" />
                      <Label
                        htmlFor="sim-varejo-r"
                        className="font-normal cursor-pointer"
                      >
                        Varejo – R$ {centsToReaisLabel(device.sale_value_cents)}
                      </Label>
                    </div>
                  ) : null}
                  {device.wholesale_value_cents != null ? (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="atacado" id="sim-atacado-r" />
                      <Label
                        htmlFor="sim-atacado-r"
                        className="font-normal cursor-pointer"
                      >
                        Atacado – R${' '}
                        {centsToReaisLabel(device.wholesale_value_cents)}
                      </Label>
                    </div>
                  ) : null}
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="sim-custom-r" />
                    <Label
                      htmlFor="sim-custom-r"
                      className="font-normal cursor-pointer"
                    >
                      Outro valor
                    </Label>
                  </div>
                </RadioGroup>
                {(simulateValueSource === 'custom' ||
                  (simulateValueSource === 'varejo' &&
                    device.sale_value_cents == null) ||
                  (simulateValueSource === 'atacado' &&
                    device.wholesale_value_cents == null)) && (
                  <Input
                    value={simulateValue}
                    onChange={(e) =>
                      setSimulateValue(formatMoneyInput(e.target.value))
                    }
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
              {simulatePaymentMethodId
                ? (() => {
                    const pm = paymentMethods.find(
                      (p) => p.id === simulatePaymentMethodId,
                    )
                    if (pm?.type === 'credito') {
                      const fees = Array.isArray(pm.credit_installment_fees)
                        ? pm.credit_installment_fees
                        : []
                      const maxInstallments =
                        fees.length > 0
                          ? Math.max(...fees.map((f) => f.installments))
                          : 12
                      return (
                        <div className="space-y-2">
                          <Label>Parcelas</Label>
                          <Select
                            value={String(simulateInstallments)}
                            onValueChange={(v) =>
                              setSimulateInstallments(parseInt(v, 10) || 1)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from(
                                { length: maxInstallments },
                                (_, i) => i + 1,
                              ).map((n) => (
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
                  })()
                : null}
              {getSimulateResult() ? (
                <div className="rounded-lg border bg-muted/50 px-4 py-3 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Resultado
                  </p>
                  {(() => {
                    const r = getSimulateResult()!
                    return (
                      <>
                        <p className="text-sm">
                          Valor a receber: R$ {centsToReaisLabel(r.receiveCents)}
                        </p>
                        <p className="text-sm">
                          Valor que preciso cobrar: R${' '}
                          {centsToReaisLabel(r.chargeCents)}
                        </p>
                        {r.installments != null &&
                        r.valuePerInstallmentCents != null ? (
                          <p className="text-sm">
                            Valor da parcela: R${' '}
                            {centsToReaisLabel(r.valuePerInstallmentCents)}
                          </p>
                        ) : null}
                        {r.feePercent > 0 ? (
                          <>
                            <p className="text-sm">
                              Valor do juros: R$ {centsToReaisLabel(r.feeCents)}
                            </p>
                            <p className="text-sm">
                              Percentual: {r.feePercent.toFixed(2)}%
                            </p>
                          </>
                        ) : null}
                      </>
                    )
                  })()}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
