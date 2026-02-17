'use client'

import { ThemeProvider } from 'next-themes'
import { QueryProvider } from './query-provider'
import { AppTooltipProvider } from './tooltip-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'

export function Providers ({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryProvider>
        <AppTooltipProvider>
          <Toaster />
          <Sonner />
          {children}
        </AppTooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  )
}




