'use client'

import { ChevronDown, Download, Plus } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { AccountingXmlExportDialog } from '@/app/(portal)/portal/vendas/AccountingXmlExportDialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import {
  createStandaloneSalesOrder,
  salesOrderNfeEmitHref,
} from '@/lib/sales-orders/create-standalone-client'
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
  const [xmlDialogOpen, setXmlDialogOpen] = useState(false)

  async function createStandaloneOrder (options?: { emitNfe?: boolean }) {
    if (isCreating) return
    setIsCreating(true)
    try {
      const result = await createStandaloneSalesOrder()
      if (result.ok === false) {
        toast({
          title: options?.emitNfe ? 'Não foi possível criar a NF-e' : 'Não foi possível criar o pedido',
          description: result.message,
          variant: 'destructive',
        })
        return
      }
      router.push(
        options?.emitNfe
          ? salesOrderNfeEmitHref(result.orderId)
          : `/portal/vendas/${encodeURIComponent(result.orderId)}`,
      )
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
        {current === 'nfce' || current === 'nfe' ? (
          <>
            <Button
              type='button'
              variant='outline'
              onClick={() => setXmlDialogOpen(true)}
              aria-label='Baixar XMLs de NFC-e e NF-e para a contabilidade'
            >
              <Download className='mr-1 h-4 w-4' />
              Baixar XMLs
            </Button>
            <AccountingXmlExportDialog
              open={xmlDialogOpen}
              onOpenChange={setXmlDialogOpen}
            />
          </>
        ) : null}
        {current === 'pedidos' ? (
          <Button type='button' disabled={isCreating} onClick={() => void createStandaloneOrder()}>
            <Plus className='mr-1 h-4 w-4' />
            {isCreating ? 'Criando...' : 'Novo pedido'}
          </Button>
        ) : null}
        {current === 'nfe' ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type='button'>
                <Plus className='mr-1 h-4 w-4' />
                Nova NF-e
                <ChevronDown className='ml-1 h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem
                disabled={isCreating}
                onSelect={(event) => {
                  event.preventDefault()
                  void createStandaloneOrder({ emitNfe: true })
                }}
              >
                {isCreating ? 'Criando...' : 'NF-e do zero'}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href='/portal/vendas/nfe/saidas/nova'>
                  A partir de pedido pago
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href='/portal/vendas/nfe/entradas/nova'>
                  NF-e de entrada
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Link href='/portal/pdv'>
          <Button variant='outline'>Frente de Caixa</Button>
        </Link>
      </div>
    </div>
  )
}
