type FeeEntry = {
  payment_method_id: string
  value_cents: number | null
  installments: number
}

type PmLike = {
  id: string
  fee_percent: number
  type: string
  credit_installment_fees?: Array<{ installments: number; fee_percent: number }>
}

/** Soma das taxas de maquininha (mesma regra do PATCH de venda). */
export function paymentFeeCentsForSaleEntries (
  validEntries: FeeEntry[],
  paymentMethods: PmLike[]
): number {
  let paymentFeeCents = 0
  for (const entry of validEntries) {
    const pm = paymentMethods.find((p) => p.id === entry.payment_method_id)
    if (!pm) continue
    const amountCents = entry.value_cents ?? 0
    if (amountCents <= 0) continue
    let feePercent = Number(pm.fee_percent) || 0
    if (pm.type === 'credito' && Array.isArray(pm.credit_installment_fees) && pm.credit_installment_fees.length > 0) {
      const byInstallments = pm.credit_installment_fees.find(
        (f) => Number(f.installments) === Number(entry.installments || 1)
      )
      if (byInstallments && byInstallments.fee_percent != null) {
        feePercent = Number(byInstallments.fee_percent) || 0
      }
    }
    if (feePercent > 0) {
      paymentFeeCents += Math.floor((amountCents * feePercent) / 100)
    }
  }
  return paymentFeeCents
}

/**
 * Lucro bruto antes da comissão: total da venda − compra − custos operacionais
 * (sem linhas derivadas de venda) − taxa de pagamento.
 */
export function grossProfitBeforeCommissionCents (
  totalSalesCents: number,
  purchaseCents: number,
  baseOperationalCents: number,
  paymentFeeCents: number
): number {
  return totalSalesCents - purchaseCents - baseOperationalCents - paymentFeeCents
}

export function commissionFromPercentOfGrossCents (
  grossProfitCents: number,
  percent: number
): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0
  if (grossProfitCents <= 0) return 0
  return Math.floor(grossProfitCents * percent / 100)
}
