'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type ProdutosGestaoHandlers = {
  openAssistenciaLinks: () => void
  openCreateProduct: () => void
}

type CtxValue = {
  register: (handlers: ProdutosGestaoHandlers) => void
  unregister: () => void
  get: () => ProdutosGestaoHandlers | null
  version: number
}

const ProdutosGestaoActionsContext = createContext<CtxValue | null>(null)

export function ProdutosGestaoActionsProvider ({ children }: { children: ReactNode }) {
  const handlersRef = useRef<ProdutosGestaoHandlers | null>(null)
  const [version, setVersion] = useState(0)

  const register = useCallback((handlers: ProdutosGestaoHandlers) => {
    handlersRef.current = handlers
    setVersion((v) => v + 1)
  }, [])

  const unregister = useCallback(() => {
    handlersRef.current = null
    setVersion((v) => v + 1)
  }, [])

  const get = useCallback(() => handlersRef.current, [])

  const value = useMemo(
    () => ({ register, unregister, get, version }),
    [register, unregister, get, version],
  )

  return (
    <ProdutosGestaoActionsContext.Provider value={value}>
      {children}
    </ProdutosGestaoActionsContext.Provider>
  )
}

export function useProdutosGestaoActionsRegistration () {
  const ctx = useContext(ProdutosGestaoActionsContext)
  if (!ctx) {
    throw new Error('useProdutosGestaoActionsRegistration requer ProdutosGestaoActionsProvider')
  }
  return ctx
}

export function useOptionalProdutosGestaoActionsRegistration () {
  return useContext(ProdutosGestaoActionsContext)
}

export function useProdutosGestaoHeaderHandlers (): ProdutosGestaoHandlers | null {
  const ctx = useContext(ProdutosGestaoActionsContext)
  if (!ctx) return null
  void ctx.version
  return ctx.get()
}
