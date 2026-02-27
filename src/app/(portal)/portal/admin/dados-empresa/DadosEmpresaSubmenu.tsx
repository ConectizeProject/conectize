'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, CreditCard, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'

const submenuItems = [
  { href: '/portal/admin/dados-empresa', label: 'Informações', icon: Building2, exact: true },
  { href: '/portal/admin/dados-empresa/formas-pagamento', label: 'Formas de pagamento', icon: CreditCard, exact: false },
  { href: '/portal/admin/dados-empresa/aparelhos', label: 'Aparelhos', icon: Smartphone, exact: false },
]

export function DadosEmpresaSubmenu() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 border-b">
      {submenuItems.map((item) => {
        const Icon = item.icon
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              'hover:text-foreground',
              isActive ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:border-muted'
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
