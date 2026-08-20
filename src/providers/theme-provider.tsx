'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

export function ThemeProvider ({ children, ...props }: ThemeProviderProps) {
  // React 19 / Next 16: next-themes injeta <script>; type application/json
  // evita o aviso "Encountered a script tag while rendering React component".
  // O boot em layout (THEME_BOOT_SCRIPT) já aplica o tema antes do paint.
  return (
    <NextThemesProvider
      {...props}
      scriptProps={{ type: 'application/json' }}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
