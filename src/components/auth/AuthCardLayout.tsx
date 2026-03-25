import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type AuthCardLayoutProps = {
  children: ReactNode
  className?: string
}

/**
 * Shell comum das telas de auth do portal (centralização e padding vertical).
 */
export function AuthCardLayout({ children, className }: AuthCardLayoutProps) {
  return (
    <div
      className={cn(
        'min-h-screen w-full px-4 sm:px-6 pt-32 pb-20 flex items-center justify-center',
        className,
      )}
    >
      {children}
    </div>
  )
}
