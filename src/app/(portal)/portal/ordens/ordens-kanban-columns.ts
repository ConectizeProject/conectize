import {
  FINALIZED_ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  type OrderStatusValue,
} from '@/lib/orders/order-status'

/** Prefixo dos ids de coluna no @dnd-kit (evita colidir com UUID da OS). */
export const KANBAN_COLUMN_ID_PREFIX = 'col:' as const

export function kanbanColumnDroppableId (status: string): string {
  return `${KANBAN_COLUMN_ID_PREFIX}${status}`
}

export function parseKanbanColumnStatus (droppableId: string): string | null {
  if (!droppableId.startsWith(KANBAN_COLUMN_ID_PREFIX)) return null
  return droppableId.slice(KANBAN_COLUMN_ID_PREFIX.length) || null
}

/** Ordem das colunas no quadro: pipeline em aberto + encerradas. */
export const KANBAN_STATUS_ORDER = [
  ...OPEN_ORDER_STATUSES,
  ...FINALIZED_ORDER_STATUSES,
] as const satisfies readonly OrderStatusValue[]

export type KanbanColumnStatus = (typeof KANBAN_STATUS_ORDER)[number]

/** Classes do indicador colorido no cabeçalho da coluna (mesma linguagem visual da lista antiga). */
export const KANBAN_STATUS_DOT_CLASSES: Record<string, string> = {
  orcamento: 'bg-amber-400 shadow-[0_0_0.6rem_rgba(251,191,36,0.9)]',
  aguardando_aprovacao: 'bg-violet-400 shadow-[0_0_0.6rem_rgba(167,139,250,0.9)]',
  aprovado: 'bg-blue-400 shadow-[0_0_0.6rem_rgba(96,165,250,0.9)]',
  aguardando_pecas: 'bg-orange-400 shadow-[0_0_0.6rem_rgba(251,146,60,0.9)]',
  em_manutencao: 'bg-indigo-400 shadow-[0_0_0.6rem_rgba(129,140,248,0.9)]',
  aguardando_retirada: 'bg-emerald-400 shadow-[0_0_0.6rem_rgba(52,211,153,0.9)]',
  finalizada: 'bg-green-400 shadow-[0_0_0.6rem_rgba(74,222,128,0.9)]',
  finalizada_sem_conserto: 'bg-slate-400 shadow-[0_0_0.6rem_rgba(148,163,184,0.9)]',
  finalizada_sem_aprovacao: 'bg-slate-400 shadow-[0_0_0.6rem_rgba(148,163,184,0.85)]',
  cancelada: 'bg-rose-400 shadow-[0_0_0.6rem_rgba(251,113,133,0.85)]',
}
