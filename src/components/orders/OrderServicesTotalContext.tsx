'use client'

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react'

type Listener = (cents: number) => void

type OrderServicesTotalContextValue = {
  setTotalValueCents: (cents: number) => void
  subscribe: (listener: Listener) => () => void
  getTotalValueCents: () => number
}

const OrderServicesTotalContext = createContext<OrderServicesTotalContextValue | null>(null)

export function OrderServicesTotalProvider({
  initialTotal = 0,
  children,
}: {
  initialTotal?: number
  children: React.ReactNode
}) {
  const totalRef = useRef(initialTotal)
  const listenersRef = useRef<Set<Listener>>(new Set())

  useEffect(() => {
    totalRef.current = initialTotal
  }, [initialTotal])

  const setTotalValueCents = useCallback((cents: number) => {
    if (totalRef.current === cents) return
    totalRef.current = cents
    listenersRef.current.forEach((listener) => listener(cents))
  }, [])

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener)
    listener(totalRef.current)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const getTotalValueCents = useCallback(() => totalRef.current, [])

  const value = useMemo<OrderServicesTotalContextValue>(
    () => ({
      setTotalValueCents,
      subscribe,
      getTotalValueCents,
    }),
    [setTotalValueCents, subscribe, getTotalValueCents],
  )

  return (
    <OrderServicesTotalContext.Provider value={value}>
      {children}
    </OrderServicesTotalContext.Provider>
  )
}

export function useOrderServicesTotal() {
  return useContext(OrderServicesTotalContext)
}

/** Retorna o total em centavos e re-renderiza apenas quando o total muda (subscription). Sem provider retorna 0. */
export function useOrderServicesTotalSubscription (): number {
  const ctx = useOrderServicesTotal()
  return useSyncExternalStore(
    (onStoreChange) => {
      if (!ctx) return () => {}
      return ctx.subscribe((_cents) => {
        onStoreChange()
      })
    },
    () => (ctx ? ctx.getTotalValueCents() : 0),
    () => 0,
  )
}
