'use client'

import dynamic from 'next/dynamic'
import { ThemeProvider } from './theme-provider'
import { QueryProvider } from './query-provider'
import { AppTooltipProvider } from './tooltip-provider'
import { AppDialogProvider } from './app-dialog-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'

const NavigationProgress = dynamic(
  () => import('@/components/NavigationProgress').then((mod) => mod.NavigationProgress),
  { ssr: false },
)

export function Providers ({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryProvider>
        <AppTooltipProvider>
          <AppDialogProvider>
            <NavigationProgress />
            <Toaster />
            <Sonner />
            {children}
          </AppDialogProvider>
        </AppTooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  )
}




