import { closestCorners, type CollisionDetection } from '@dnd-kit/core'
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

const KANBAN_FILTER_STRING_KEYS = [
  'q',
  'cpf',
  'osNumber',
  'status',
  'customerId',
  'customerName',
  'deviceModelId',
  'createdFrom',
  'createdTo',
  'readyFrom',
  'readyTo',
] as const

export type KanbanFilterStrings = Record<
  (typeof KANBAN_FILTER_STRING_KEYS)[number],
  string
>

/** Indica se a listagem do Kanban deve carregar todas as colunas finais (e expandir as com resultado). */
export function hasActiveKanbanFilters (f: KanbanFilterStrings): boolean {
  for (const k of KANBAN_FILTER_STRING_KEYS) {
    if (String(f[k] || '').trim() !== '') return true
  }
  return false
}

/**
 * Chave estável do “visual de drag” por coluna: só muda quando esta coluna
 * de fato precisa atualizar (evita re-render de todas as colunas a cada `overId`).
 */
export function kanbanColumnDragUiKey (
  status: string,
  orders: readonly { id: string }[],
  dragActiveId: string | null,
  dragOverId: string | null,
  activeDragSourceStatus: string | null,
): string {
  if (!dragActiveId) return ''
  const d = kanbanColumnDroppableId(status)
  const isTargetDrop =
    !!dragOverId &&
    dragOverId === d &&
    activeDragSourceStatus != null &&
    activeDragSourceStatus !== status
  const draggedHere = orders.some((o) => o.id === dragActiveId)
  const sourceSlot = draggedHere ? (dragOverId === d ? 'in' : 'out') : 'none'
  return `${isTargetDrop ? 1 : 0}:${sourceSlot}`
}

/** Só mede colisão contra colunas (`col:`), reduz trabalho no algoritmo. */
export const kanbanColumnsCollisionDetection: CollisionDetection = (args) => {
  const cols = args.droppableContainers.filter((c) =>
    String(c.id).startsWith(KANBAN_COLUMN_ID_PREFIX),
  )
  if (cols.length === 0) return []
  return closestCorners({ ...args, droppableContainers: cols })
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
