'use client'

import { Download, Plus } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { brazilPreviousMonthRange } from '@/lib/dashboard/brazil-day'
import { portalFetch } from '@/lib/portal/portal-fetch'
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

function attachmentFilename (header: string | null, fallback: string) {
  const match = String(header || '').match(/filename="([^"]+)"/i)
  return match?.[1] || fallback
}

export function VendasModuleTabs () {
  const pathname = usePathname() || '/portal/vendas'
  const router = useRouter()
  const current = activeTab(pathname)
  const [isCreating, setIsCreating] = useState(false)
  const [isDownloadingXml, setIsDownloadingXml] = useState(false)
  const previousMonth = useMemo(() => brazilPreviousMonthRange(), [])

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

  async function downloadAccountingXml () {
    if (isDownloadingXml) return
    setIsDownloadingXml(true)
    try {
      const res = await portalFetch('/api/portal/fiscal/documents/accounting-xml', {
        cache: 'no-store',
      })
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json') || !res.ok) {
        const data = await res.json().catch(() => null)
        toast({
          title: 'Não foi possível baixar os XMLs',
          description: data?.message || data?.error || 'Tente novamente em instantes.',
          variant: 'destructive',
        })
        return
      }

      const blob = await res.blob()
      const filename = attachmentFilename(
        res.headers.get('content-disposition'),
        `xml-nfe-nfce-${previousMonth.label}.zip`,
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      const nfeCount = Number(res.headers.get('x-xml-nfe-count') || 0)
      const nfceCount = Number(res.headers.get('x-xml-nfce-count') || 0)
      const missingCount = Number(res.headers.get('x-xml-missing-count') || 0)
      const month = res.headers.get('x-xml-month') || previousMonth.displayLabel
      toast({
        variant: missingCount > 0 ? 'default' : 'success',
        title: `XMLs de ${month} prontos`,
        description: missingCount > 0
          ? `${nfceCount} NFC-e e ${nfeCount} NF-e no ZIP. ${missingCount} nota(s) sem XML (veja notas-sem-xml.txt).`
          : `${nfceCount} NFC-e e ${nfeCount} NF-e. Envie o arquivo à contabilidade.`,
      })
    } catch {
      toast({
        title: 'Não foi possível baixar os XMLs',
        description: 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsDownloadingXml(false)
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
          <Button
            type='button'
            variant='outline'
            disabled={isDownloadingXml}
            onClick={() => void downloadAccountingXml()}
            aria-label={`Baixar XMLs de NFC-e e NF-e de ${previousMonth.displayLabel} para a contabilidade`}
          >
            <Download className='mr-1 h-4 w-4' />
            {isDownloadingXml
              ? 'Baixando XMLs...'
              : `XMLs de ${previousMonth.displayLabel}`}
          </Button>
        ) : null}
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
