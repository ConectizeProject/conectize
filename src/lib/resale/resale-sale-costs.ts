/** Linha de custo gerada ao registrar venda (taxa de maquininha). */
export const PAYMENT_FEE_COST_LABEL = 'Taxa forma de pagamento'

/** Prefixo da linha de comissão (descrição pode incluir nome do colaborador). */
export const COMMISSION_COST_PREFIX = 'Comissão venda'

export function isPaymentFeeCostDescription (description: string | null | undefined): boolean {
  return (description || '').trim().toLowerCase() === PAYMENT_FEE_COST_LABEL.toLowerCase()
}

export function isCommissionCostDescription (description: string | null | undefined): boolean {
  return (description || '').trim().startsWith(COMMISSION_COST_PREFIX)
}

export function isSaleDerivedCostDescription (description: string | null | undefined): boolean {
  return isPaymentFeeCostDescription(description) || isCommissionCostDescription(description)
}

export function stripSaleDerivedCosts<T extends { description: string | null; value_cents: number }> (
  costs: T[]
): T[] {
  return costs.filter((c) => !isSaleDerivedCostDescription(c.description))
}

export function buildCommissionCostDescription (userDisplayName: string): string {
  const name = (userDisplayName || '').trim() || 'Colaborador'
  return `${COMMISSION_COST_PREFIX} – ${name}`
}

/** Extrai o nome do colaborador da descrição da linha de custo (ex.: "Comissão venda – João"). */
export function parseCommissionWorkerLabelFromDescription (
  description: string | null | undefined,
): string | null {
  const d = (description || '').trim()
  if (!d.startsWith(COMMISSION_COST_PREFIX)) return null
  const rest = d.slice(COMMISSION_COST_PREFIX.length).trim()
  const m = /^[–-]\s*(.+)$/.exec(rest)
  return m ? m[1].trim() : (rest || null)
}
