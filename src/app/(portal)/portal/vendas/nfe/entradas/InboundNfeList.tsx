'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy, Download, FileDown, FileUp, Loader2, MoreHorizontal, Plus, Printer, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { maskedFromCents } from '@/lib/utils/money'
import { toast } from '@/hooks/use-toast'
import { appConfirm } from '@/lib/ui/app-dialogs'

type InboundDoc = {
  id: string
  entry_kind?: 'products' | 'used_devices'
  source_mode?: 'xml' | 'manual'
  entry_type?: 'own_issuance' | 'third_party' | 'import' | 'xml_import'
  access_key: string | null
  series: number
  number: number
  issued_at: string | null
  issuer_name: string | null
  seller_name?: string | null
  total_cents: number
  status: 'draft' | 'posted' | 'canceled'
  fiscal_document?: {
    id: string
    status: string
    series: number
    number: number
    access_key: string | null
    sefaz_status_message: string | null
  } | null
  created_at: string
}

function statusLabel (doc: InboundDoc) {
  if (doc.fiscal_document?.status === 'authorized') return 'Autorizada'
  if (doc.fiscal_document?.status === 'pending') return 'Processando na SEFAZ'
  if (doc.fiscal_document?.status === 'rejected') return 'Rejeitada'
  if (doc.fiscal_document?.status === 'denied') return 'Denegada'
  if (doc.fiscal_document?.status === 'canceled') return 'Cancelada na SEFAZ'
  if (doc.status === 'posted') return 'Lançada'
  if (doc.status === 'canceled') return 'Cancelada'
  return 'Rascunho'
}

function statusVariant (doc: InboundDoc): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (doc.fiscal_document?.status === 'authorized' || doc.status === 'posted') return 'default'
  if (
    doc.fiscal_document?.status === 'rejected' ||
    doc.fiscal_document?.status === 'denied' ||
    doc.status === 'canceled'
  ) return 'destructive'
  if (doc.fiscal_document?.status === 'pending') return 'outline'
  return 'secondary'
}

function kindLabel (doc: InboundDoc) {
  if (doc.entry_type === 'xml_import') return 'Importação de XML'
  if (doc.entry_type === 'third_party') return 'Emitida por terceiros'
  if (doc.entry_type === 'import') return 'Importação'
  return 'Emissão própria'
}

function formatDate (value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

type InboundNfeListProps = {
  title?: string
  showOutboundLink?: boolean
}

export function InboundNfeList ({
  title = 'NF-e de entrada',
  showOutboundLink = true,
}: InboundNfeListProps) {
  const router = useRouter()
  const [documents, setDocuments] = useState<InboundDoc[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  function detailHref (id: string) {
    return `/portal/vendas/nfe/entradas/${encodeURIComponent(id)}`
  }

  function openDocumentFile (doc: InboundDoc, kind: 'danfe' | 'pdf' | 'xml') {
    const fiscalDocument = doc.fiscal_document
    const hasAvailableFile = fiscalDocument?.status === 'authorized' || Boolean(doc.access_key)
    if (!hasAvailableFile) {
      toast({
        title: kind === 'xml' ? 'XML indisponível' : 'DANFE indisponível',
        description: 'O arquivo estará disponível depois da importação ou autorização da NF-e.',
      })
      return
    }
    const endpoint = kind === 'xml' ? 'xml' : 'danfe'
    const download = kind === 'pdf' ? '?download=1' : ''
    const path = fiscalDocument?.status === 'authorized'
      ? `/api/portal/fiscal/documents/${encodeURIComponent(fiscalDocument.id)}/${endpoint}`
      : `/api/portal/fiscal/inbound-nfe/${encodeURIComponent(doc.id)}/${endpoint}`
    window.open(
      `${path}${download}`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  async function cloneDocument (doc: InboundDoc) {
    if (busyId) return
    setBusyId(doc.id)
    try {
      const res = await portalFetch(`/api/portal/fiscal/inbound-nfe/${encodeURIComponent(doc.id)}/clone`, {
        method: 'POST',
      })
      const data = await res?.json().catch(() => null)
      if (!data?.ok || !data.document?.id) {
        toast({
          title: 'Não foi possível clonar',
          description: data?.message || data?.error || 'Tente novamente.',
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'Entrada clonada', description: 'Revise os dados antes de emitir.' })
      router.push(detailHref(String(data.document.id)))
    } finally {
      setBusyId(null)
    }
  }

  async function sendToSefaz (doc: InboundDoc) {
    if (busyId || doc.entry_type !== 'own_issuance' || doc.status !== 'draft') return

    const confirmed = await appConfirm({
      title: 'Enviar NF-e de entrada à SEFAZ?',
      description: `Origem: ${doc.seller_name || doc.issuer_name || 'Não informada'}. Total: R$ ${maskedFromCents(doc.total_cents)}. Uma numeração fiscal real será reservada para esta emissão.`,
      confirmLabel: 'Enviar à SEFAZ',
    })
    if (!confirmed) return

    setBusyId(doc.id)
    try {
      const res = await portalFetch(
        `/api/portal/fiscal/inbound-nfe/${encodeURIComponent(doc.id)}/emit`,
        { method: 'POST' },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'NF-e não enviada',
          description: data?.message || data?.error || 'Revise os dados fiscais e tente novamente.',
          variant: 'destructive',
        })
        return
      }
      toast({
        variant: 'success',
        title: data.alreadyAuthorized ? 'NF-e já autorizada' : 'NF-e autorizada',
        description: `Número fiscal ${data.fiscalDocument?.series}/${data.fiscalDocument?.number}.`,
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function load () {
    setIsLoading(true)
    try {
      const res = await portalFetch('/api/portal/fiscal/inbound-nfe')
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        setDocuments([])
        return
      }
      setDocuments(Array.isArray(data.documents) ? data.documents : [])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-medium'>{title}</h2>
          <p className='text-sm text-muted-foreground'>
            Emissões próprias, notas de terceiros, importações e XMLs de entrada.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          {showOutboundLink ? (
            <Link href='/portal/vendas/nfe'>
              <Button type='button' variant='outline'>Saídas</Button>
            </Link>
          ) : null}
          <Link href='/portal/vendas/nfe/entradas/nova'>
            <Button type='button'>
              <Plus className='mr-1 h-4 w-4' />
              Nova NF-e de entrada
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>Entradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className='text-sm text-muted-foreground'>Carregando...</p>
          ) : documents.length === 0 ? (
            <div className='flex flex-col items-center justify-center gap-2 py-10 text-center'>
              <FileUp className='h-8 w-8 text-muted-foreground' />
              <p className='text-sm text-muted-foreground'>
                Nenhuma NF-e de entrada ainda.
              </p>
              <Link href='/portal/vendas/nfe/entradas/nova'>
                <Button type='button' variant='outline' size='sm'>Criar primeira entrada</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className='text-right'>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow
                    key={doc.id}
                    role='link'
                    tabIndex={0}
                    className='cursor-pointer'
                    onClick={() => router.push(detailHref(doc.id))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        router.push(detailHref(doc.id))
                      }
                    }}
                  >
                    <TableCell>
                      {doc.series}/{doc.number}
                    </TableCell>
                    <TableCell>{kindLabel(doc)}</TableCell>
                    <TableCell className='max-w-[220px] truncate'>
                      {doc.entry_kind === 'used_devices'
                        ? (doc.seller_name || doc.issuer_name || '—')
                        : (doc.issuer_name || '—')}
                    </TableCell>
                    <TableCell>{formatDate(doc.issued_at)}</TableCell>
                    <TableCell>{maskedFromCents(doc.total_cents)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(doc)}>
                        {statusLabel(doc)}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            aria-label='Ações da nota'
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreHorizontal className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end' onClick={(event) => event.stopPropagation()}>
                          <DropdownMenuItem onSelect={() => openDocumentFile(doc, 'danfe')}>
                            <Printer className='mr-2 h-4 w-4' />
                            Imprimir NF-e
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={
                              busyId === doc.id ||
                              doc.entry_type !== 'own_issuance' ||
                              doc.status !== 'draft' ||
                              doc.fiscal_document?.status === 'authorized' ||
                              doc.fiscal_document?.status === 'denied' ||
                              doc.fiscal_document?.status === 'canceled'
                            }
                            onSelect={() => void sendToSefaz(doc)}
                          >
                            {busyId === doc.id
                              ? <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                              : <Send className='mr-2 h-4 w-4' />}
                            Enviar à SEFAZ
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={busyId === doc.id} onSelect={() => void cloneDocument(doc)}>
                            <Copy className='mr-2 h-4 w-4' />
                            Clonar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => openDocumentFile(doc, 'xml')}>
                            <Download className='mr-2 h-4 w-4' />
                            Baixar XML
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openDocumentFile(doc, 'pdf')}>
                            <FileDown className='mr-2 h-4 w-4' />
                            Baixar PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
