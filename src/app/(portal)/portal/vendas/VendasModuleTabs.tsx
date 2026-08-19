'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/portal/vendas', id: 'pedidos', label: 'Pedidos' },
  { href: '/portal/vendas/nfce', id: 'nfce', label: 'NFC-e' },
  { href: '/portal/vendas/nfe', id: 'nfe', label: 'NF-e' },
] as const

function activeTab (pathname: string) {
  if (pathname.startsWith('/portal/vendas/nfce')) return 'nfce'
  if (pathname.startsWith('/portal/vendas/nfe')) return 'nfe'
  return 'pedidos'
}

export function VendasModuleTabs () {
  const pathname = usePathname() || '/portal/vendas'
  const current = activeTab(pathname)

  return (
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <div>
        <h1 className='text-2xl font-semibold'>Vendas</h1>
        <nav className='mt-3 inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground' aria-label='Seções de vendas'>
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
                current === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:text-foreground',
              )}
              aria-current={current === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <Link href='/portal/pdv'>
        <Button variant='outline'>Frente de Caixa</Button>
      </Link>
    </div>
  )
}
