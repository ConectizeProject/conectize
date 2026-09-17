'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Download } from 'lucide-react'
import { AccountingXmlExportDialog } from '@/app/(portal)/portal/vendas/AccountingXmlExportDialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/portal/contador/nfce', id: 'nfce', label: 'NFC-e' },
  { href: '/portal/contador/nfe', id: 'nfe', label: 'NF-e' },
] as const

function activeTab (pathname: string) {
  if (pathname.startsWith('/portal/contador/nfe')) return 'nfe'
  return 'nfce'
}

export function ContadorModuleTabs () {
  const pathname = usePathname() || '/portal/contador/nfce'
  const current = activeTab(pathname)
  const [xmlDialogOpen, setXmlDialogOpen] = useState(false)

  return (
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <div>
        <h1 className='text-2xl font-semibold'>Notas fiscais</h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          Área do contador — consulta, XML e DANFE.
        </p>
        <nav
          className='mt-3 inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground'
          aria-label='Tipos de nota'
        >
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
      </div>
    </div>
  )
}
