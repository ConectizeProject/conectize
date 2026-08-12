'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

export function ThemeProvider ({ children, ...props }: ThemeProviderProps) {
  // React 19 / Next 16: no client, evita o erro
  // "Encountered a script tag while rendering React component".
  // No SSR o script anti-FOUC do next-themes continua normal (scriptProps undefined).
  // O boot em layout (THEME_BOOT_SCRIPT) já aplica o tema antes do paint.
  const scriptProps =
    typeof window === 'undefined'
      ? undefined
      : ({ type: 'application/json' } as const)

  return (
    <NextThemesProvider
      {...props}
      scriptProps={scriptProps}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
