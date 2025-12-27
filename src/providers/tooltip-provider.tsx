'use client'

import { TooltipProvider } from '@/components/ui/tooltip'

export function AppTooltipProvider ({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>
}



