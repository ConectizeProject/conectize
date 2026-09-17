'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, FileDown, Printer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  canDownloadFiscalXml,
  canPrintFiscalDocument,
  fiscalDocumentStatusBadgeVariant,
  fiscalDocumentStatusLabel,
} from '@/lib/fiscal/document-status'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { maskedFromCents } from '@/lib/utils/money'
import {
  nfeDanfeDownloadUrl,
  nfeDanfePreviewUrl,
  openFiscalDanfePrint,
} from '@/app/(portal)/portal/vendas/SalesOrderCupomPrint'

type Props = {
  model: '55' | '65'
  documentId: string
}

type DocView = {
  id: string
  model: string
  series: number
  number: number
  status: string
  environment?: string | null
  access_key?: string | null
  customer_name?: string | null
  total_cents?: number | null
  authorized_at?: string | null
  sefaz_status_message?: string | null
}

export function ContadorFiscalDocumentViewer ({ model, documentId }: Props) {
  const [doc, setDoc] = useState<DocView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const kind = model === '55' ? 'NF-e' : 'NFC-e'
  const listHref = model === '55' ? '/portal/contador/nfe' : '/portal/contador/nfce'

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await portalFetch(
          `/api/portal/fiscal/documents/${encodeURIComponent(documentId)}`,
        )
        const data = await res?.json().catch(() => null)
        if (cancelled) return
        if (!data?.ok || !data.fiscal_document) {
          setError(data?.error || 'not_found')
          setDoc(null)
          return
        }
        setDoc(data.fiscal_document as DocView)
      } catch {
        if (!cancelled) {
          setError('load_failed')
          setDoc(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [documentId])

  if (loading) {
    return <p className='text-sm text-muted-foreground'>Carregando {kind}...</p>
  }

  if (error || !doc) {
    return (
      <div className='space-y-3'>
        <p className='text-sm text-destructive'>Não foi possível carregar a nota.</p>
        <Link href={listHref}>
          <Button type='button' variant='outline'>
            <ArrowLeft className='mr-1 h-4 w-4' />
            Voltar
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <Link href={listHref}>
          <Button type='button' variant='outline' size='sm'>
            <ArrowLeft className='mr-1 h-4 w-4' />
            Voltar
          </Button>
        </Link>
        <div className='flex flex-wrap gap-2'>
          {canPrintFiscalDocument(doc.status) && model === '55' ? (
            <>
              <a href={nfeDanfePreviewUrl(doc.id)} target='_blank' rel='noopener noreferrer'>
                <Button type='button' variant='outline' size='sm'>
                  <Printer className='mr-1 h-4 w-4' />
                  DANFE
                </Button>
              </a>
              <a href={nfeDanfeDownloadUrl(doc.id)} download>
                <Button type='button' variant='outline' size='sm'>
                  <FileDown className='mr-1 h-4 w-4' />
                  PDF
                </Button>
              </a>
            </>
          ) : null}
          {canPrintFiscalDocument(doc.status) && model !== '55' ? (
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => openFiscalDanfePrint(doc.id, model)}
            >
              <Printer className='mr-1 h-4 w-4' />
              DANFE
            </Button>
          ) : null}
          {canDownloadFiscalXml(doc.status) ? (
            <a
              href={`/api/portal/fiscal/documents/${encodeURIComponent(doc.id)}/xml`}
              download
            >
              <Button type='button' size='sm'>
                <Download className='mr-1 h-4 w-4' />
                XML
              </Button>
            </a>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex flex-wrap items-center gap-2 text-lg'>
            {kind} · Série {doc.series} · Nº {doc.number}
            <Badge variant={fiscalDocumentStatusBadgeVariant(doc.status)}>
              {fiscalDocumentStatusLabel(doc.status, model)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
          <div>
            <p className='text-muted-foreground'>Destinatário</p>
            <p className='font-medium'>{doc.customer_name || 'Consumidor Final'}</p>
          </div>
          <div>
            <p className='text-muted-foreground'>Total</p>
            <p className='font-medium'>
              {doc.total_cents == null ? '—' : maskedFromCents(doc.total_cents)}
            </p>
          </div>
          <div className='sm:col-span-2'>
            <p className='text-muted-foreground'>Chave de acesso</p>
            <p className='break-all font-mono text-xs'>{doc.access_key || '—'}</p>
          </div>
          {doc.environment === 'homologacao' ? (
            <p className='sm:col-span-2 text-xs text-muted-foreground'>Ambiente de homologação</p>
          ) : null}
          {doc.sefaz_status_message ? (
            <p className='sm:col-span-2 text-xs text-destructive'>{doc.sefaz_status_message}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
