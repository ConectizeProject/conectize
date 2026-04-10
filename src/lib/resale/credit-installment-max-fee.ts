export type CreditFeeRow = { installments: number; fee_percent: number }

/**
 * Taxa (%) de cartão para N parcelas, usando a mesma regra do simulador:
 * parcela exata ou maior faixa com installments <= N.
 */
export function feePercentForInstallmentCount (
  fees: CreditFeeRow[],
  installmentCount: number,
): number {
  if (!fees.length) return 0
  const sorted = [...fees].sort((a, b) => a.installments - b.installments)
  const exact = sorted.find((f) => f.installments === installmentCount)
  if (exact) return exact.fee_percent
  const match =
    sorted.filter((f) => f.installments <= installmentCount).pop() ?? sorted[0]
  return match ? match.fee_percent : 0
}

export type PaymentMethodLike = {
  type: string
  credit_installment_fees?: CreditFeeRow[] | null
}

/** Maior taxa entre todas as formas de pagamento tipo crédito, para N parcelas. */
export function maxCreditFeePercentForInstallments (
  methods: PaymentMethodLike[],
  installmentCount: number,
): number {
  let max = 0
  for (const pm of methods) {
    if (pm.type !== 'credito') continue
    const fees = Array.isArray(pm.credit_installment_fees) ? pm.credit_installment_fees : []
    const p = feePercentForInstallmentCount(fees, installmentCount)
    max = Math.max(max, p)
  }
  return max
}

/** Valor total a cobrar no cartão para a loja receber netReceiveCents líquidos (após taxa). */
export function totalChargeCentsFromNetReceive (
  netReceiveCents: number,
  feePercent: number,
): number {
  if (netReceiveCents <= 0) return 0
  if (feePercent >= 100) return netReceiveCents
  return Math.round(netReceiveCents / (1 - feePercent / 100))
}

export type InstallmentRow = {
  installments: number
  feePercent: number
  totalChargeCents: number
  installmentValueCents: number
}

export function buildInstallmentTableRows (
  saleValueCents: number,
  methods: PaymentMethodLike[],
  maxParcelas = 12,
): InstallmentRow[] {
  const rows: InstallmentRow[] = []
  for (let n = 1; n <= maxParcelas; n++) {
    const feePercent = maxCreditFeePercentForInstallments(methods, n)
    const totalChargeCents = totalChargeCentsFromNetReceive(saleValueCents, feePercent)
    const installmentValueCents = Math.round(totalChargeCents / n)
    rows.push({
      installments: n,
      feePercent,
      totalChargeCents,
      installmentValueCents,
    })
  }
  return rows
}

export function getInstallmentRowForCount (
  saleValueCents: number,
  methods: PaymentMethodLike[],
  installmentCount: number,
): InstallmentRow | null {
  if (saleValueCents <= 0 || installmentCount < 1) return null
  const rows = buildInstallmentTableRows(
    saleValueCents,
    methods,
    Math.max(12, installmentCount),
  )
  return rows.find((r) => r.installments === installmentCount) ?? null
}
