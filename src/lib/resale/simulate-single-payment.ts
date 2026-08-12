/**
 * Mesma regra do modal "Simular pagamento" da revenda:
 * valor líquido a receber → total a cobrar com taxa da forma escolhida.
 */
export type PaymentMethodForSimulate = {
  type: string
  fee_percent: number
  credit_installment_fees?: { installments: number; fee_percent: number }[] | null
}

export type SimulatePaymentResult = {
  receiveCents: number
  feePercent: number
  feeCents: number
  chargeCents: number
  installments?: number
  valuePerInstallmentCents?: number
}

export function computeSimulatePaymentResult (
  receiveCents: number,
  pm: PaymentMethodForSimulate,
  installmentCount: number,
): SimulatePaymentResult | null {
  if (receiveCents <= 0) return null

  if (pm.type === 'dinheiro') {
    return {
      receiveCents,
      feePercent: 0,
      feeCents: 0,
      chargeCents: receiveCents,
    }
  }

  const feePercent =
    pm.type === 'credito'
      ? (() => {
          const fees = Array.isArray(pm.credit_installment_fees)
            ? pm.credit_installment_fees
            : []
          const sorted = [...fees].sort((a, b) => a.installments - b.installments)
          const exact = sorted.find((f) => f.installments === installmentCount)
          const match =
            exact ??
            sorted.filter((f) => f.installments <= installmentCount).pop() ??
            sorted[0]
          return match ? match.fee_percent : 0
        })()
      : (pm.fee_percent ?? 0)

  if (feePercent >= 100) {
    return {
      receiveCents,
      feePercent,
      feeCents: 0,
      chargeCents: receiveCents,
    }
  }

  const chargeCents = Math.round(receiveCents / (1 - feePercent / 100))
  const feeCents = chargeCents - receiveCents

  if (pm.type === 'credito') {
    const valuePerInstallmentCents = Math.round(chargeCents / installmentCount)
    return {
      receiveCents,
      feePercent,
      feeCents,
      chargeCents,
      installments: installmentCount,
      valuePerInstallmentCents,
    }
  }

  return { receiveCents, feePercent, feeCents, chargeCents }
}
