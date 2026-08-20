'use client'

import dynamic from 'next/dynamic'
import { ThemeProvider } from './theme-provider'
import { AppTooltipProvider } from './tooltip-provider'
import { AppDialogProvider } from './app-dialog-provider'
import { Toaster } from '@/components/ui/toaster'

const NavigationProgress = dynamic(
  () => import('@/components/NavigationProgress').then((mod) => mod.NavigationProgress),
  { ssr: false },
)

export function Providers ({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AppTooltipProvider>
        <AppDialogProvider>
          <NavigationProgress />
          <Toaster />
          {children}
        </AppDialogProvider>
      </AppTooltipProvider>
    </ThemeProvider>
  )
}
