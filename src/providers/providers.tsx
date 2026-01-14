'use client'

import { QueryProvider } from './query-provider'
import { AppTooltipProvider } from './tooltip-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export function Providers ({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AppTooltipProvider>
        <Toaster />
        <Sonner />
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </AppTooltipProvider>
    </QueryProvider>
  )
}




