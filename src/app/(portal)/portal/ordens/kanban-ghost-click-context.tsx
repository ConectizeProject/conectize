'use client'

import { createContext, useContext, type MutableRefObject } from 'react'

/** Ref atualizado só no board (um lugar) — evita `useDndMonitor` em cada card. */
export type KanbanGhostClickOrderIdRef = MutableRefObject<string | null>

export const KanbanGhostClickOrderIdRefContext =
  createContext<KanbanGhostClickOrderIdRef | null>(null)

export function useKanbanGhostClickOrderIdRef (): KanbanGhostClickOrderIdRef {
  const ctx = useContext(KanbanGhostClickOrderIdRefContext)
  if (!ctx) {
    throw new Error('useKanbanGhostClickOrderIdRef só dentro do kanban com provider')
  }
  return ctx
}
