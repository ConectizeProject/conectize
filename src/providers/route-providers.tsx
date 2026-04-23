'use client'

import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { Providers } from '@/providers/providers'

export function RouteProviders ({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <Providers>{children}</Providers>
    </NuqsAdapter>
  )
}

