'use client'

import { splitPortalVariationDisplayName } from '@/lib/products/variation-display-name'
import { cn } from '@/lib/utils'

type Props = {
  name: string
  parentName?: string | null
  truncate?: boolean
  inactive?: boolean
  className?: string
}

/**
 * Nome da variação: prefixo do pai com fundo cinza claro, depois o atributo/valor.
 */
export function VariationDisplayName ({
  name,
  parentName,
  truncate = false,
  inactive = false,
  className,
}: Props) {
  const { parentLabel, suffix } = splitPortalVariationDisplayName(name, parentName)

  if (!parentLabel) {
    return (
      <span
        className={cn(
          'min-w-0',
          truncate ? 'truncate' : 'break-words',
          inactive && 'text-muted-foreground line-through',
          className,
        )}
      >
        {name}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-full items-center gap-1.5',
        truncate && 'overflow-hidden',
        inactive && 'text-muted-foreground',
        className,
      )}
    >
      <span
        className={cn(
          'shrink-0 rounded-sm bg-muted/80 px-1.5 py-0.5 text-[0.925em] font-medium text-muted-foreground',
          inactive && 'line-through',
        )}
      >
        {parentLabel}
      </span>
      <span
        className={cn(
          'min-w-0 font-medium text-foreground',
          truncate ? 'truncate' : 'break-words',
          inactive && 'line-through',
        )}
      >
        {suffix}
      </span>
    </span>
  )
}
