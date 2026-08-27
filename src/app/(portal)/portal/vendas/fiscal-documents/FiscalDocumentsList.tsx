'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, FileDown, MoreHorizontal, Pencil, Printer, Send, Trash2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { appAlert, appConfirm, appPrompt } from '@/lib/ui/app-dialogs'
import { maskedFromCents } from '@/lib/utils/money'
import {
  canCancelFiscalDocument,
  canDeleteFiscalDocument,
  canDownloadFiscalXml,
  canEditFiscalDocument,
  canPrintFiscalDocument,
  canSendFiscalDocument,
  fiscalCancelDeadlineHint,
  fiscalDocumentStatusBadgeVariant,
  fiscalDocumentStatusLabel,
  isNfceCancelDeadlineExpired,
  NFCE_CANCEL_EXPIRED_ALERT,
} from '@/lib/fiscal/document-status'
import type { FiscalDocumentListRow } from '@/lib/fiscal/document-types'
import { nfeDanfeDownloadUrl, nfeDanfePreviewUrl, openFiscalDanfePrint } from '@/app/(portal)/portal/vendas/SalesOrderCupomPrint'
import { VendasListPagination } from '@/app/(portal)/portal/vendas/VendasListPagination'
import { VENDAS_LIST_PAGE_SIZE } from '@/lib/vendas/list-pagination'

type Props = {
  model: '55' | '65'
}

type FiscalListFilters = {
  from?: string
  to?: string
  status?: string
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
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load (nextPage = page, overrides?: FiscalListFilters) {
    setIsLoading(true)
    try {
      const nextFrom = overrides?.from ?? from
      const nextTo = overrides?.to ?? to
      const nextStatus = overrides?.status ?? status
      const params = new URLSearchParams()
      params.set('model', model)
      params.set('page', String(nextPage))
      if (nextFrom) params.set('from', nextFrom)
      if (nextTo) params.set('to', nextTo)
      if (nextStatus) params.set('status', nextStatus)
      const res = await portalFetch(`/api/portal/fiscal/documents?${params.toString()}`)
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        setDocuments([])
        setTotal(0)
        return
      }
      setDocuments(Array.isArray(data.documents) ? data.documents : [])
      setTotal(Number(data.total) || 0)
      setPage(nextPage)
    } finally {
      setHasLoaded(true)
      setIsLoading(false)
    }
  }

  function clearFilters () {
    setFrom('')
    setTo('')
    setStatus('')
    void load(1, { from: '', to: '', status: '' })
  }

  const hasActiveFilters = Boolean(from || to || status)

  useEffect(() => {
    if (hasLoaded) return
    void load(1)
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
        openFiscalDanfePrint(String(next.id), model)
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
    if (doc.model !== '55' && isNfceCancelDeadlineExpired(doc.authorized_at)) {
      await appAlert(NFCE_CANCEL_EXPIRED_ALERT)
      return
    }
    const justification = await appPrompt({
      title: 'Cancelar nota?',
      description: `${fiscalCancelDeadlineHint(doc.model)} A justificativa vai para a SEFAZ e precisa ter pelo menos 15 caracteres.`,
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
        if (data?.error === 'cancel_deadline_expired') {
          await appAlert(NFCE_CANCEL_EXPIRED_ALERT)
          return
        }
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

  async function deleteDocument (doc: FiscalDocumentListRow) {
    const kind = model === '55' ? 'NF-e' : 'NFC-e'
    if (!(await appConfirm({
      title: `Excluir ${kind}?`,
      description: doc.status === 'rejected'
        ? `A ${kind} rejeitada será removida da lista. Depois você pode emitir outra a partir do pedido.`
        : `Esta ${kind} ainda não foi enviada à SEFAZ. Excluir remove o rascunho; você pode emitir outra a partir do pedido.`,
      confirmLabel: 'Excluir',
      destructive: true,
    }))) return

    setBusyId(doc.id)
    try {
      const res = await portalFetch(`/api/portal/fiscal/documents/${encodeURIComponent(doc.id)}`, {
        method: 'DELETE',
      })
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Não foi possível excluir',
          description: data?.message || data?.error || `A ${kind} não foi excluída.`,
          variant: 'destructive',
        })
        return
      }
      toast({ variant: 'success', title: `${kind} excluída` })
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
      {model === '55' ? (
        <div className='flex flex-wrap items-center justify-end gap-2'>
          <Link href='/portal/vendas/nfe/entradas'>
            <Button type='button' variant='outline'>Entradas</Button>
          </Link>
          <Link href='/portal/vendas/nfe/entradas/nova'>
            <Button type='button'>Nova NF-e de entrada</Button>
          </Link>
        </div>
      ) : null}
      <div className='flex flex-col gap-4 lg:flex-row lg:items-start'>
        <Card className='lg:w-72 lg:shrink-0'>
          <CardHeader className='pb-3'>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-3'>
            <div className='space-y-1.5'>
              <Label htmlFor={`fiscal-${model}-filter-from`}>Data inicial</Label>
              <Input
                id={`fiscal-${model}-filter-from`}
                type='date'
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor={`fiscal-${model}-filter-to`}>Data final</Label>
              <Input
                id={`fiscal-${model}-filter-to`}
                type='date'
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor={`fiscal-${model}-filter-status`}>Status</Label>
              <select
                id={`fiscal-${model}-filter-status`}
                className='h-10 w-full rounded-md border border-input bg-background px-3 text-sm'
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value=''>Todos os status</option>
                <option value='pending'>Pendente</option>
                <option value='authorized'>Autorizada</option>
                <option value='rejected'>Rejeitada</option>
                <option value='denied'>Denegada</option>
                <option value='canceled'>Cancelada</option>
              </select>
            </div>
            <div className='grid gap-2 pt-1'>
              <Button
                type='button'
                onClick={() => {
                  void load(1)
                }}
                disabled={isLoading}
              >
                {isLoading ? 'Carregando...' : 'Aplicar'}
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={clearFilters}
                disabled={isLoading || !hasActiveFilters}
              >
                Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className='min-w-0 flex-1'>
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
              {isLoading && documents.length === 0 ? (
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
                      <TableCell
                        onClick={(event) => event.stopPropagation()}
                      >
                        {doc.order_number && doc.sales_order_id ? (
                          <Link
                            href={`/portal/vendas/${encodeURIComponent(doc.sales_order_id)}`}
                            className='font-medium text-primary underline-offset-4 hover:underline'
                          >
                            #{doc.order_number}
                          </Link>
                        ) : doc.order_number ? (
                          `#${doc.order_number}`
                        ) : (
                          '—'
                        )}
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
                            {canPrintFiscalDocument(doc.status) && model === '55' ? (
                              <DropdownMenuItem asChild>
                                <a href={nfeDanfePreviewUrl(doc.id)} target='_blank' rel='noopener noreferrer'>
                                  <Printer className='mr-2 h-4 w-4' />
                                  Imprimir DANFE
                                </a>
                              </DropdownMenuItem>
                            ) : null}
                            {canPrintFiscalDocument(doc.status) && model !== '55' ? (
                              <DropdownMenuItem
                                onSelect={() => {
                                  openFiscalDanfePrint(doc.id, model)
                                }}
                              >
                                <Printer className='mr-2 h-4 w-4' />
                                Imprimir DANFE
                              </DropdownMenuItem>
                            ) : null}
                            {canPrintFiscalDocument(doc.status) && model === '55' ? (
                              <DropdownMenuItem asChild>
                                <a href={nfeDanfeDownloadUrl(doc.id)} download>
                                  <FileDown className='mr-2 h-4 w-4' />
                                  Baixar PDF
                                </a>
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
                            {canDeleteFiscalDocument(doc.status, doc.access_key) && model === '55' ? (
                              <>
                                {canCancelFiscalDocument(doc.status) ? null : <DropdownMenuSeparator />}
                                <DropdownMenuItem
                                  disabled={isBusy}
                                  className='text-destructive focus:text-destructive'
                                  onSelect={(event) => {
                                    event.preventDefault()
                                    void deleteDocument(doc)
                                  }}
                                >
                                  <Trash2 className='mr-2 h-4 w-4' />
                                  Excluir
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
            <VendasListPagination
              page={page}
              pageSize={VENDAS_LIST_PAGE_SIZE}
              total={total}
              disabled={isLoading}
              onPageChange={(nextPage) => {
                void load(nextPage)
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
