'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { toast } from '@/hooks/use-toast'
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
  const router = useRouter()
  const current = activeTab(pathname)
  const [isCreating, setIsCreating] = useState(false)

  async function createStandaloneOrder () {
    if (isCreating) return
    setIsCreating(true)
    try {
      const res = await portalFetch('/api/portal/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ standalone: true, items: [] }),
      })
      const data = await res?.json().catch(() => null)
      const orderId = String(data?.order_id || data?.order?.id || '')
      if (!data?.ok || !orderId) {
        toast({
          title: 'Não foi possível criar o pedido',
          description: data?.error === 'cash_not_open'
            ? 'Este pedido não depende do caixa. Tente novamente.'
            : (data?.message || data?.error || 'Erro ao criar pedido.'),
          variant: 'destructive',
        })
        return
      }
      router.push(`/portal/vendas/${encodeURIComponent(orderId)}`)
    } finally {
      setIsCreating(false)
    }
  }

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
      <div className='flex flex-wrap items-center gap-2'>
        {current === 'pedidos' ? (
          <Button type='button' disabled={isCreating} onClick={() => void createStandaloneOrder()}>
            <Plus className='mr-1 h-4 w-4' />
            {isCreating ? 'Criando...' : 'Novo pedido'}
          </Button>
        ) : null}
        {current === 'nfe' ? (
          <Link href='/portal/vendas/nfe/entradas/nova'>
            <Button type='button'>
              <Plus className='mr-1 h-4 w-4' />
              NF-e de entrada
            </Button>
          </Link>
        ) : null}
        <Link href='/portal/pdv'>
          <Button variant='outline'>Frente de Caixa</Button>
        </Link>
      </div>
    </div>
  )
}
