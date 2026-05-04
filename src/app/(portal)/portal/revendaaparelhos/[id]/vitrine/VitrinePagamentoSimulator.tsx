'use client'

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
import type { PortalPaymentMethodCatalogItem } from '@/lib/portal/payment-methods-server'
import { computeSimulatePaymentResult } from '@/lib/resale/simulate-single-payment'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import { Calculator } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type ValueSource = 'varejo' | 'atacado' | 'custom'

type Props = {
  paymentMethods: PortalPaymentMethodCatalogItem[]
  saleValueCents: number | null
  wholesaleValueCents: number | null
}

function initialValueSource (
  sale: number | null,
  wholesale: number | null,
): ValueSource {
  if (sale != null && sale > 0) return 'varejo'
  if (wholesale != null && wholesale > 0) return 'atacado'
  return 'custom'
}

export function VitrinePagamentoSimulator ({
  paymentMethods,
  saleValueCents,
  wholesaleValueCents,
}: Props) {
  const [valueSource, setValueSource] = useState<ValueSource>(() =>
    initialValueSource(saleValueCents, wholesaleValueCents),
  )
  const [customValue, setCustomValue] = useState(() => {
    const s = initialValueSource(saleValueCents, wholesaleValueCents)
    if (s === 'varejo' && saleValueCents != null) return maskedFromCents(saleValueCents)
    if (s === 'atacado' && wholesaleValueCents != null) {
      return maskedFromCents(wholesaleValueCents)
    }
    return ''
  })
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [installments, setInstallments] = useState(1)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (paymentMethodId || paymentMethods.length === 0) return
    setPaymentMethodId(paymentMethods[0].id)
  }, [paymentMethodId, paymentMethods])

  const baseReceiveCents = useMemo(() => {
    if (valueSource === 'varejo' && saleValueCents != null) return saleValueCents
    if (valueSource === 'atacado' && wholesaleValueCents != null) {
      return wholesaleValueCents
    }
    return moneyToCentsFromMasked(customValue)
  }, [valueSource, saleValueCents, wholesaleValueCents, customValue])

  const selectedPm = paymentMethods.find((p) => p.id === paymentMethodId)

  const simulateResult = useMemo(() => {
    if (baseReceiveCents == null || baseReceiveCents <= 0 || !selectedPm) return null
    return computeSimulatePaymentResult(baseReceiveCents, selectedPm, installments)
  }, [baseReceiveCents, selectedPm, installments])

  const maxInstallmentsForCredit = useMemo(() => {
    if (selectedPm?.type !== 'credito') return 12
    const fees = Array.isArray(selectedPm.credit_installment_fees)
      ? selectedPm.credit_installment_fees
      : []
    if (fees.length === 0) return 12
    return Math.max(...fees.map((f) => f.installments))
  }, [selectedPm])

  if (paymentMethods.length === 0) {
    return null
  }

  const showCustomInput =
    valueSource === 'custom' ||
    (valueSource === 'varejo' && saleValueCents == null) ||
    (valueSource === 'atacado' && wholesaleValueCents == null)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Calculator className="h-4 w-4 shrink-0" aria-hidden />
        Simular
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <div className="max-h-[min(90vh,720px)] overflow-y-auto p-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle>Simular pagamento</DialogTitle>
              <DialogDescription>
                Informe o valor que deseja receber e a forma de pagamento. A taxa é descontada do valor
                cobrado ao cliente.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-4">
          <div className="space-y-3">
            <Label>Valor a receber</Label>
            <RadioGroup
              value={valueSource}
              onValueChange={(v: ValueSource) => {
                setValueSource(v)
                if (v === 'varejo' && saleValueCents != null) {
                  setCustomValue(maskedFromCents(saleValueCents))
                } else if (v === 'atacado' && wholesaleValueCents != null) {
                  setCustomValue(maskedFromCents(wholesaleValueCents))
                } else if (v === 'custom') {
                  setCustomValue('')
                }
              }}
              className="flex flex-col gap-2"
            >
              {saleValueCents != null && saleValueCents > 0 ? (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="varejo" id="vit-sim-varejo" />
                  <Label htmlFor="vit-sim-varejo" className="cursor-pointer font-normal">
                    Varejo – R$ {maskedFromCents(saleValueCents)}
                  </Label>
                </div>
              ) : null}
              {wholesaleValueCents != null && wholesaleValueCents > 0 ? (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="atacado" id="vit-sim-atacado" />
                  <Label htmlFor="vit-sim-atacado" className="cursor-pointer font-normal">
                    Atacado – R$ {maskedFromCents(wholesaleValueCents)}
                  </Label>
                </div>
              ) : null}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="vit-sim-custom" />
                <Label htmlFor="vit-sim-custom" className="cursor-pointer font-normal">
                  Outro valor
                </Label>
              </div>
            </RadioGroup>
            {showCustomInput ? (
              <Input
                value={customValue}
                onChange={(e) => setCustomValue(formatMoneyInput(e.target.value))}
                placeholder="0,00"
                className="mt-1"
                inputMode="numeric"
                autoComplete="off"
              />
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Select
              value={paymentMethodId}
              onValueChange={(v) => {
                setPaymentMethodId(v)
                setInstallments(1)
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

          {selectedPm?.type === 'credito' ? (
            <div className="space-y-2">
              <Label>Parcelas</Label>
              <Select
                value={String(installments)}
                onValueChange={(v) => setInstallments(parseInt(v, 10) || 1)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxInstallmentsForCredit }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}×
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {simulateResult ? (
            <div className="space-y-2 rounded-lg border bg-muted/50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Resultado
              </p>
              <p className="text-sm">
                Valor a receber: R$ {maskedFromCents(simulateResult.receiveCents)}
              </p>
              <p className="text-sm">
                Valor que preciso cobrar: R$ {maskedFromCents(simulateResult.chargeCents)}
              </p>
              {simulateResult.installments != null &&
              simulateResult.valuePerInstallmentCents != null ? (
                <p className="text-sm">
                  Valor da parcela: R$ {maskedFromCents(simulateResult.valuePerInstallmentCents)}
                </p>
              ) : null}
              {simulateResult.feePercent > 0 ? (
                <>
                  <p className="text-sm">Valor do juros: R$ {maskedFromCents(simulateResult.feeCents)}</p>
                  <p className="text-sm">Percentual: {simulateResult.feePercent.toFixed(2)}%</p>
                </>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Informe um valor válido e selecione uma forma de pagamento para ver o resultado.
            </p>
          )}
            </div>
          </div>

          <DialogFooter className="border-t bg-muted/30 px-6 py-4 sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
