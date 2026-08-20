'use client'

import { Providers } from '@/providers/providers'

export function RouteProviders ({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>
}
