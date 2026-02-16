'use client'

import { QueryProvider } from './query-provider'
import { AppTooltipProvider } from './tooltip-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'

export function Providers ({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AppTooltipProvider>
        <Toaster />
        <Sonner />
        {children}
      </AppTooltipProvider>
    </QueryProvider>
  )
}




