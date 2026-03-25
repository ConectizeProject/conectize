/**
 * Status de ordem de serviço: labels, conjuntos e helpers únicos para UI e API.
 */

export const ORDER_STATUS_LABELS: Record<string, string> = {
  orcamento: 'Orçamento',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  aguardando_pecas: 'Aguardando peças',
  em_manutencao: 'Em manutenção',
  aguardando_retirada: 'Aguardando retirada',
  finalizada: 'Finalizada',
  finalizada_sem_conserto: 'Finalizada sem conserto',
  finalizada_sem_aprovacao: 'Finalizada sem aprovação',
  cancelada: 'Cancelada',
}

/** Status em andamento (não finalizados). */
export const OPEN_ORDER_STATUSES = [
  'orcamento',
  'aguardando_aprovacao',
  'aprovado',
  'aguardando_pecas',
  'em_manutencao',
  'aguardando_retirada',
] as const

/** Status que encerram o fluxo operacional da OS. */
export const FINALIZED_ORDER_STATUSES = [
  'finalizada',
  'finalizada_sem_conserto',
  'finalizada_sem_aprovacao',
  'cancelada',
] as const

export const ORDER_STATUS_VALUES = [
  ...OPEN_ORDER_STATUSES,
  ...FINALIZED_ORDER_STATUSES,
] as const

export type OrderStatusValue = (typeof ORDER_STATUS_VALUES)[number]

export const ORDER_STATUS_SET = new Set<string>(ORDER_STATUS_VALUES)

export const OPEN_ORDER_STATUS_SET = new Set<string>(OPEN_ORDER_STATUSES)

export const FINALIZED_ORDER_STATUS_SET = new Set<string>(FINALIZED_ORDER_STATUSES)

/**
 * Abertos em que consumo de estoque de produtos pode aplicar (exclui orçamento).
 * Usar em conjunto com {@link FINALIZED_ORDER_STATUS_SET} para regras de movimentação.
 */
export const STOCK_CONSUMING_ORDER_STATUS_SET = new Set<string>(
  OPEN_ORDER_STATUSES.filter((s) => s !== 'orcamento'),
)

export function getOrderStatusLabel (status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status
}

export function isValidOrderStatus (value: string): boolean {
  return ORDER_STATUS_SET.has(value)
}

export function isFinalizedOrderStatus (status: string): boolean {
  return FINALIZED_ORDER_STATUS_SET.has(status)
}

export function isOpenOrderStatus (value: string): boolean {
  return OPEN_ORDER_STATUS_SET.has(value)
}
