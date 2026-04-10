'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LayoutGrid, Package, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'

const submenuItems = [
  { tipo: 'seminovos' as const, label: 'Seminovos', icon: Smartphone },
  { tipo: 'lacrados' as const, label: 'Lacrados', icon: Package },
]

type SeminovosSubmenuProps = {
  /** Lojista B2B: só troca seminovo/lacrado na URL do varejo (sem listagem operacional). */
  retailerMode?: boolean
}

export function SeminovosSubmenu ({ retailerMode = false }: SeminovosSubmenuProps) {
  const pathname = usePathname()
  const sp = useSearchParams()
  const current = sp.get('tipo') === 'lacrados' ? 'lacrados' : 'seminovos'
  const onOperacional = pathname === '/portal/seminovos'
  const onVarejo = pathname.startsWith('/portal/seminovos/varejo')

  const varejoHref =
    current === 'lacrados' ? '/portal/seminovos/varejo?tipo=lacrados' : '/portal/seminovos/varejo'

  function hrefFor (tipo: 'seminovos' | 'lacrados') {
    const n = new URLSearchParams(sp.toString())
    if (tipo === 'seminovos') n.delete('tipo')
    else n.set('tipo', 'lacrados')
    const q = n.toString()
    return q ? `/portal/seminovos?${q}` : '/portal/seminovos'
  }

  function hrefForVarejoTipo (tipo: 'seminovos' | 'lacrados') {
    return tipo === 'lacrados'
      ? '/portal/seminovos/varejo?tipo=lacrados'
      : '/portal/seminovos/varejo'
  }

  if (retailerMode) {
    return (
      <nav className="flex flex-wrap gap-1 border-b">
        {submenuItems.map((item) => {
          const Icon = item.icon
          const isActive = onVarejo && item.tipo === current
          return (
            <Link
              key={item.tipo}
              href={hrefForVarejoTipo(item.tipo)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                'hover:text-foreground',
                isActive ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:border-muted',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
        <span
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px pointer-events-none',
            onVarejo ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent',
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          Lista varejo
        </span>
      </nav>
    )
  }

  return (
    <nav className="flex flex-wrap gap-1 border-b">
      {submenuItems.map((item) => {
        const Icon = item.icon
        const isActive = onOperacional && item.tipo === current
        return (
          <Link
            key={item.tipo}
            href={hrefFor(item.tipo)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              'hover:text-foreground',
              isActive ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:border-muted',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
      <Link
        href={varejoHref}
        className={cn(
          'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
          'hover:text-foreground',
          onVarejo ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:border-muted',
        )}
      >
        <LayoutGrid className="h-4 w-4" />
        Lista varejo
      </Link>
    </nav>
  )
}
