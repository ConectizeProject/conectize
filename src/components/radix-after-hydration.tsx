'use client'

import type { ReactNode } from 'react'
import { useHasMounted } from '@/hooks/use-has-mounted'

type RadixAfterHydrationProps = {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Radix (Select, DropdownMenu, etc.) gera ids via React.useId.
 * Com SSR + Suspense/streaming, a árvore pode divergir e causar hydration mismatch.
 * Renderiza filhos só após o mount no cliente.
 */
export function RadixAfterHydration ({ children, fallback = null }: RadixAfterHydrationProps) {
  const hasMounted = useHasMounted()
  if (!hasMounted) return fallback
  return children
}
