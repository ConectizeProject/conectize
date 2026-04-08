'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Package, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'

const submenuItems = [
  { tipo: 'seminovos' as const, label: 'Seminovos', icon: Smartphone },
  { tipo: 'lacrados' as const, label: 'Lacrados', icon: Package },
]

export function SeminovosSubmenu () {
  const sp = useSearchParams()
  const current = sp.get('tipo') === 'lacrados' ? 'lacrados' : 'seminovos'

  function hrefFor (tipo: 'seminovos' | 'lacrados') {
    const n = new URLSearchParams(sp.toString())
    if (tipo === 'seminovos') n.delete('tipo')
    else n.set('tipo', 'lacrados')
    const q = n.toString()
    return q ? `/portal/seminovos?${q}` : '/portal/seminovos'
  }

  return (
    <nav className="flex gap-1 border-b">
      {submenuItems.map((item) => {
        const Icon = item.icon
        const isActive = item.tipo === current
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
    </nav>
  )
}
