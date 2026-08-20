'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, ExternalLink, MoreHorizontal, Pencil, Printer, Send, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { toast } from '@/hooks/use-toast'
import { appPrompt } from '@/lib/ui/app-dialogs'
import { maskedFromCents } from '@/lib/utils/money'
import {
  canCancelFiscalDocument,
  canDownloadFiscalXml,
  canEditFiscalDocument,
  canPrintFiscalDocument,
  canSendFiscalDocument,
  fiscalDocumentStatusBadgeVariant,
  fiscalDocumentStatusLabel,
} from '@/lib/fiscal/document-status'
import type { FiscalDocumentListRow } from '@/lib/fiscal/document-types'
import { openNfceDanfePrint } from '@/app/(portal)/portal/vendas/SalesOrderCupomPrint'

type Props = {
  model: '55' | '65'
}

function editorHref (model: '55' | '65', id: string) {
  return model === '55'
    ? `/portal/vendas/nfe/${encodeURIComponent(id)}`
    : `/portal/vendas/nfce/${encodeURIComponent(id)}`
}

function sendLabel (model: '55' | '65') {
  return model === '55' ? 'Enviar NF-e' : 'Enviar NFC-e'
}

export function FiscalDocumentsList ({ model }: Props) {
  const router = useRouter()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('')
  const [documents, setDocuments] = useState<FiscalDocumentListRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load () {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('model', model)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (status) params.set('status', status)
      const res = await portalFetch(`/api/portal/fiscal/documents?${params.toString()}`)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model])

  async function sendDocument (doc: FiscalDocumentListRow) {
    setBusyId(doc.id)
    try {
      const res = await portalFetch(`/api/portal/fiscal/documents/${encodeURIComponent(doc.id)}/retry`, {
        method: 'POST',
      })
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: `${model === '55' ? 'NF-e' : 'NFC-e'} não autorizada`,
          description: data?.message || data?.error || 'Não foi possível enviar a nota.',
          variant: 'destructive',
        })
        if (canEditFiscalDocument(doc.status)) {
          router.push(editorHref(model, doc.id))
        }
        return
      }
      const next = data.fiscal_document as { id?: string, status?: string, sefaz_status_message?: string | null } | null
      await load()
      if (data.danfe_url && next?.id) {
        toast({
          variant: 'success',
          title: `${model === '55' ? 'NF-e' : 'NFC-e'} autorizada`,
          description: 'Abrindo a nota para impressão.',
        })
        openNfceDanfePrint(String(next.id))
        return
      }
      toast({
        title: `${model === '55' ? 'NF-e' : 'NFC-e'} não autorizada`,
        description: next?.sefaz_status_message || 'A SEFAZ retornou a nota sem autorização.',
        variant: 'destructive',
      })
      router.push(editorHref(model, next?.id || doc.id))
    } finally {
      setBusyId(null)
    }
  }

  async function cancelDocument (doc: FiscalDocumentListRow) {
    const justification = await appPrompt({
      title: 'Cancelar nota?',
      description: 'A justificativa vai para a SEFAZ e precisa ter pelo menos 15 caracteres.',
      label: 'Justificativa',
      required: true,
      destructive: true,
      confirmLabel: 'Cancelar nota',
    })
    if (justification == null) return
    if (justification.trim().length < 15) {
      toast({
        title: 'Justificativa curta',
        description: 'Informe pelo menos 15 caracteres.',
        variant: 'destructive',
      })
      return
    }

    setBusyId(doc.id)
    try {
      const res = await portalFetch(`/api/portal/fiscal/documents/${encodeURIComponent(doc.id)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justification: justification.trim() }),
      })
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Não foi possível cancelar',
          description: data?.message || data?.error || 'A SEFAZ não confirmou o cancelamento.',
          variant: 'destructive',
        })
        return
      }
      toast({ variant: 'success', title: 'Cancelamento enviado' })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const kind = model === '55' ? 'NF-e' : 'NFC-e'
  const emptyHint = model === '55'
    ? 'Ainda não há NF-e (modelo 55). Gere a partir de um pedido pago em Pedidos.'
    : 'Nenhuma NFC-e encontrada. Emita a partir de um pedido pago.'

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <Input type='date' value={from} onChange={(e) => setFrom(e.target.value)} aria-label='Data inicial' />
          <Input type='date' value={to} onChange={(e) => setTo(e.target.value)} aria-label='Data final' />
          <select
            className='h-10 rounded border bg-background px-2 text-sm'
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label='Status'
          >
            <option value=''>Todos os status</option>
            <option value='pending'>Pendente</option>
            <option value='authorized'>Autorizada</option>
            <option value='rejected'>Rejeitada</option>
            <option value='denied'>Denegada</option>
            <option value='canceled'>Cancelada</option>
          </select>
          <Button onClick={() => void load()} disabled={isLoading}>
            {isLoading ? 'Carregando...' : 'Aplicar'}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className='w-12 text-right'>
                  <span className='sr-only'>Opções</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className='py-6 text-center text-muted-foreground'>
                    Carregando {kind}...
                  </TableCell>
                </TableRow>
              ) : documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className='py-6 text-center text-muted-foreground'>
                    {emptyHint}
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => {
                  const isBusy = busyId === doc.id
                  const sefazError = (doc.status === 'rejected' || doc.status === 'denied' || doc.status === 'pending')
                    ? (doc.sefaz_status_message || doc.sefaz_status_code)
                    : null

                  return (
                    <TableRow
                      key={doc.id}
                      className='cursor-pointer'
                      onClick={() => router.push(editorHref(model, doc.id))}
                    >
                      <TableCell className='whitespace-nowrap font-medium'>
                        Série {doc.series} · Nº {doc.number}
                        {doc.environment === 'homologacao' ? (
                          <span className='mt-0.5 block text-xs font-normal text-muted-foreground'>Homologação</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {doc.order_number ? `#${doc.order_number}` : '—'}
                      </TableCell>
                      <TableCell>{doc.customer_name || 'Consumidor Final'}</TableCell>
                      <TableCell className='font-medium'>
                        {doc.total_cents == null ? '—' : maskedFromCents(doc.total_cents)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={fiscalDocumentStatusBadgeVariant(doc.status)}>
                          {fiscalDocumentStatusLabel(doc.status, model)}
                        </Badge>
                        {sefazError ? (
                          <p className='mt-1 max-w-xs text-xs text-destructive'>{sefazError}</p>
                        ) : null}
                      </TableCell>
                      <TableCell
                        className='text-right'
                        onClick={(event) => event.stopPropagation()}
                      >
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8'
                              disabled={isBusy}
                              aria-label={`Opções da ${kind} ${doc.number}`}
                            >
                              <MoreHorizontal className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end' className='min-w-44'>
                            <DropdownMenuItem asChild>
                              <Link href={editorHref(model, doc.id)}>
                                <Pencil className='mr-2 h-4 w-4' />
                                {canEditFiscalDocument(doc.status) ? 'Editar dados' : 'Ver nota'}
                              </Link>
                            </DropdownMenuItem>
                            {canSendFiscalDocument(doc.status) ? (
                              <DropdownMenuItem
                                disabled={isBusy}
                                onSelect={(event) => {
                                  event.preventDefault()
                                  void sendDocument(doc)
                                }}
                              >
                                <Send className='mr-2 h-4 w-4' />
                                {sendLabel(model)}
                              </DropdownMenuItem>
                            ) : null}
                            {canPrintFiscalDocument(doc.status) ? (
                              <DropdownMenuItem
                                onSelect={(event) => {
                                  event.preventDefault()
                                  openNfceDanfePrint(doc.id)
                                }}
                              >
                                <Printer className='mr-2 h-4 w-4' />
                                Imprimir DANFE
                              </DropdownMenuItem>
                            ) : null}
                            {canDownloadFiscalXml(doc.status) ? (
                              <DropdownMenuItem asChild>
                                <a
                                  href={`/api/portal/fiscal/documents/${encodeURIComponent(doc.id)}/xml`}
                                  download
                                >
                                  <Download className='mr-2 h-4 w-4' />
                                  Baixar XML
                                </a>
                              </DropdownMenuItem>
                            ) : null}
                            {doc.sales_order_id ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/portal/vendas/${encodeURIComponent(doc.sales_order_id)}`}>
                                  <ExternalLink className='mr-2 h-4 w-4' />
                                  Ver pedido
                                </Link>
                              </DropdownMenuItem>
                            ) : null}
                            {canCancelFiscalDocument(doc.status) ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled={isBusy}
                                  className='text-destructive focus:text-destructive'
                                  onSelect={(event) => {
                                    event.preventDefault()
                                    void cancelDocument(doc)
                                  }}
                                >
                                  <XCircle className='mr-2 h-4 w-4' />
                                  Cancelar na SEFAZ
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
