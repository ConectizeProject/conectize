'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, LayoutGrid, Package, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { REVENDA_BASE, revendaPath } from '@/lib/revenda/revenda-paths'

const submenuItems = [
  { segment: 'seminovos' as const, label: 'Seminovos', icon: Smartphone },
  { segment: 'novos' as const, label: 'Novos', icon: Package },
]

type SeminovosSubmenuProps = {
  /** Lojista B2B: só a listagem pública. */
  retailerMode?: boolean
}

function isRevendaListagemPath (pathname: string) {
  return pathname === REVENDA_BASE || pathname === `${REVENDA_BASE}/`
}

export function SeminovosSubmenu ({ retailerMode = false }: SeminovosSubmenuProps) {
  const pathname = usePathname()
  const onListagem = isRevendaListagemPath(pathname)
  const onSeminovos = pathname === revendaPath.seminovos
  const onNovos = pathname === revendaPath.novos
  const onRef = pathname === revendaPath.referenciaPrecos

  const listagemLink = (
    <Link
      href={revendaPath.listagem}
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
        'hover:text-foreground',
        onListagem ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:border-muted',
      )}
    >
      <LayoutGrid className="h-4 w-4" />
      Listagem
    </Link>
  )

  if (retailerMode) {
    return (
      <nav className="flex flex-wrap gap-1 border-b">
        {listagemLink}
      </nav>
    )
  }

  return (
    <nav className="flex flex-wrap gap-1 border-b">
      {listagemLink}
      {submenuItems.map((item) => {
        const Icon = item.icon
        const href =
          item.segment === 'seminovos' ? revendaPath.seminovos : revendaPath.novos
        const isActive = item.segment === 'seminovos' ? onSeminovos : onNovos
        return (
          <Link
            key={item.segment}
            href={href}
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
        href={revendaPath.referenciaPrecos}
        className={cn(
          'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
          'hover:text-foreground',
          onRef ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:border-muted',
        )}
      >
        <BarChart3 className="h-4 w-4" />
        Referência
      </Link>
    </nav>
  )
}
