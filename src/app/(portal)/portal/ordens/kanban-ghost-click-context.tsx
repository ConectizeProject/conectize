'use client'

import { createContext, type MutableRefObject, useContext } from 'react'

/** Evita navegar para a OS após drag, menu de status ou clique fantasma. */
export type KanbanNavGuard = {
  ghostOrderIdRef: MutableRefObject<string | null>
  suppressLinkUntilRef: MutableRefObject<number>
}

export const KanbanNavGuardContext = createContext<KanbanNavGuard | null>(null)

/** @deprecated use useKanbanNavGuard — mantido para o card ler o id fantasma */
export function useKanbanGhostClickOrderIdRef (): MutableRefObject<string | null> {
  const ctx = useContext(KanbanNavGuardContext)
  if (!ctx) {
    throw new Error('useKanbanGhostClickOrderIdRef só dentro do kanban com provider')
  }
  return ctx.ghostOrderIdRef
}

export function useKanbanNavGuard (): KanbanNavGuard {
  const ctx = useContext(KanbanNavGuardContext)
  if (!ctx) {
    throw new Error('useKanbanNavGuard só dentro do kanban com provider')
  }
  return ctx
}
