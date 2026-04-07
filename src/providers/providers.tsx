'use client'

import { Suspense } from 'react'
import { ThemeProvider } from 'next-themes'
import { QueryProvider } from './query-provider'
import { AppTooltipProvider } from './tooltip-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { NavigationProgress } from '@/components/NavigationProgress'

export function Providers ({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryProvider>
        <AppTooltipProvider>
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          <Toaster />
          <Sonner />
          {children}
        </AppTooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  )
}




