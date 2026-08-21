'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
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
import type { FiscalDocumentDetail } from '@/lib/fiscal/document-types'
import { maskFci, originRequiresFci } from '@/lib/fiscal/fci'
import { maskCest, maskNcm } from '@/lib/fiscal/ncm'
import { isProductFiscalCorrectionError } from '@/lib/fiscal/product-fiscal-errors'
import {
  NFCE_PAYMENT_TYPE_LABELS,
  NFCE_PAYMENT_TYPES,
  isNfcePaymentType,
  nfcePaymentTypeFromCatalog,
  type NfcePaymentType,
} from '@/lib/fiscal/payment-method-type'
import { fiscalRejectionGuidance } from '@/lib/fiscal/rejection-guidance'
import { openNfceDanfePrint } from '@/app/(portal)/portal/vendas/SalesOrderCupomPrint'

const ORIGIN_OPTIONS = [
  { value: '0', label: '0 - Nacional' },
  { value: '1', label: '1 - Estrangeira (importação direta)' },
  { value: '2', label: '2 - Estrangeira (mercado interno)' },
  { value: '3', label: '3 - Nacional, CI 40–70%' },
  { value: '4', label: '4 - Nacional, processo básico' },
  { value: '5', label: '5 - Nacional, CI ≤ 40%' },
  { value: '6', label: '6 - Estrangeira, sem similar (imp. direta)' },
  { value: '7', label: '7 - Estrangeira, sem similar (mercado interno)' },
  { value: '8', label: '8 - Nacional, CI > 70%' },
]

type ItemDraft = {
  id: string
  productId: string
  name: string
  sku: string | null
  quantity: number
  subtotalCents: number
  ncm: string
  cest: string
  fiscalOrigin: string
  fci: string
  fiscalUnit: string
}

type PaymentDraft = {
  id: string
  paymentMethodId: string
  paymentMethodType: NfcePaymentType
  amountCents: number
}

type CatalogPaymentMethod = {
  id: string
  description: string
  type: string
}

type Props = {
  documentId: string
}

function listHref (model: '55' | '65') {
  return model === '55' ? '/portal/vendas/nfe' : '/portal/vendas/nfce'
}

function sendLabel (model: '55' | '65') {
  return model === '55' ? 'Enviar NF-e' : 'Enviar NFC-e'
}

function paymentsFromDocument (next: FiscalDocumentDetail): PaymentDraft[] {
  return (next.payments || []).map((payment) => ({
    id: payment.id,
    paymentMethodId: payment.payment_method_id || '',
    paymentMethodType: isNfcePaymentType(payment.payment_method_type) ? payment.payment_method_type : 'outro',
    amountCents: payment.amount_cents,
  }))
}

function itemsFromDocument (next: FiscalDocumentDetail): ItemDraft[] {
  return next.items.map((item) => ({
    id: item.id,
    productId: item.product_id,
    name: item.name,
    sku: item.sku,
    quantity: item.quantity,
    subtotalCents: item.subtotal_cents,
    ncm: maskNcm(item.ncm || ''),
    cest: maskCest(item.cest || ''),
    fiscalOrigin: String(item.fiscal_origin ?? 0),
    fci: maskFci(item.fci || ''),
    fiscalUnit: item.fiscal_unit || 'UN',
  }))
}

export function FiscalDocumentEditor ({ documentId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const askedToCorrect = searchParams.get('corrigir') === '1'
  const correctionToastShown = useRef(false)
  const [document, setDocument] = useState<FiscalDocumentDetail | null>(null)
  const [danfeUrl, setDanfeUrl] = useState<string | null>(null)
  const [xmlUrl, setXmlUrl] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerDocument, setCustomerDocument] = useState('')
  const [items, setItems] = useState<ItemDraft[]>([])
  const [payments, setPayments] = useState<PaymentDraft[]>([])
  const [paymentMethods, setPaymentMethods] = useState<CatalogPaymentMethod[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const model = document?.model ?? '65'
  const kind = model === '55' ? 'NF-e' : 'NFC-e'
  const editable = canEditFiscalDocument(document?.status)
  const showFciColumn = useMemo(
    () => items.some((item) => originRequiresFci(item.fiscalOrigin)),
    [items],
  )

  async function load () {
    setIsLoading(true)
    try {
      const [docRes, methodsRes] = await Promise.all([
        portalFetch(`/api/portal/fiscal/documents/${encodeURIComponent(documentId)}`),
        portalFetch('/api/portal/payment-methods'),
      ])
      const data = await docRes?.json().catch(() => null)
      const methodsData = await methodsRes?.json().catch(() => null)
      if (!data?.ok || !data.fiscal_document) {
        toast({
          title: 'Nota não encontrada',
          description: data?.message || data?.error || 'Não foi possível carregar a nota.',
          variant: 'destructive',
        })
        return
      }
      const next = data.fiscal_document as FiscalDocumentDetail
      setDocument(next)
      setDanfeUrl(data.danfe_url || null)
      setXmlUrl(data.xml_url || null)
      setCustomerName(next.order?.customer_name || 'Consumidor Final')
      setCustomerDocument(formatCpfCnpj(next.order?.customer_document || ''))
      setItems(itemsFromDocument(next))
      setPayments(paymentsFromDocument(next))
      if (methodsData?.ok && Array.isArray(methodsData.paymentMethods)) {
        setPaymentMethods(methodsData.paymentMethods.map((method: Record<string, unknown>) => ({
          id: String(method.id || ''),
          description: String(method.description || 'Pagamento'),
          type: String(method.type || ''),
        })).filter((method: CatalogPaymentMethod) => method.id))
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [documentId])

  useEffect(() => {
    if (!askedToCorrect || !document || correctionToastShown.current) return
    correctionToastShown.current = true
    const code = document.sefaz_status_code
    toast({
      title: code === 'cest_not_required'
        ? 'Remova o CEST'
        : code === 'cest_required' || code === 'cest_mismatch'
          ? 'Ajuste o CEST'
          : code === 'product_missing_fci'
            ? 'Informe o FCI'
            : 'Preencha NCM e CEST',
      description: document.sefaz_status_message
        || 'Alguns produtos desta venda estão sem os dados fiscais necessários para emitir a NFC-e.',
    })
  }, [askedToCorrect, document])

  async function saveDraft () {
    const res = await portalFetch(`/api/portal/fiscal/documents/${encodeURIComponent(documentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: customerName,
        customer_document: customerDocument,
        items: items.map((item) => ({
          productId: item.productId,
          ncm: item.ncm,
          cest: item.cest,
          fiscalOrigin: Number(item.fiscalOrigin),
          fci: originRequiresFci(item.fiscalOrigin) ? item.fci : null,
          fiscalUnit: item.fiscalUnit,
        })),
        payments: payments.map((payment) => ({
          id: payment.id,
          paymentMethodId: payment.paymentMethodId || null,
          paymentMethodType: payment.paymentMethodType,
        })),
      }),
    })
    const data = await res?.json().catch(() => null)
    if (!data?.ok) {
      return {
        ok: false as const,
        message: data?.message || data?.error || 'Não foi possível salvar os dados da nota.',
      }
    }
    const next = data.fiscal_document as FiscalDocumentDetail
    setDocument(next)
    setDanfeUrl(data.danfe_url || null)
    setXmlUrl(data.xml_url || null)
    setCustomerName(next.order?.customer_name || 'Consumidor Final')
    setCustomerDocument(formatCpfCnpj(next.order?.customer_document || ''))
    setItems(itemsFromDocument(next))
    setPayments(paymentsFromDocument(next))
    return { ok: true as const }
  }

  async function handleSave () {
    setIsSaving(true)
    try {
      const result = await saveDraft()
      if (!result.ok) {
        toast({ title: 'Não foi possível salvar', description: result.message, variant: 'destructive' })
        return
      }
      toast({
        variant: 'success',
        title: 'Dados da nota salvos',
        description: 'NCM, CEST e forma de pagamento foram atualizados. A NFC-e só muda na SEFAZ depois de reenviar.',
      })
      if (askedToCorrect) {
        router.replace(`${listHref(model)}/${encodeURIComponent(documentId)}`)
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSend () {
    setIsSending(true)
    try {
      if (editable) {
        const saved = await saveDraft()
        if (!saved.ok) {
          toast({ title: 'Corrija os dados antes de enviar', description: saved.message, variant: 'destructive' })
          return
        }
      }
      const res = await portalFetch(`/api/portal/fiscal/documents/${encodeURIComponent(documentId)}/retry`, {
        method: 'POST',
      })
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        if (data?.needs_correction) {
          toast({
            title: 'Complete NCM e CEST',
            description: data.message || 'Preencha os dados fiscais dos itens antes de enviar a NFC-e.',
          })
          await load()
          return
        }
        toast({
          title: `${kind} não autorizada`,
          description: data?.message || data?.error || 'Não foi possível enviar a nota.',
          variant: 'destructive',
        })
        await load()
        return
      }
      if (data.danfe_url) {
        toast({
          variant: 'success',
          title: `${kind} autorizada`,
          description: 'Abrindo a nota para impressão.',
        })
        const authorizedId = String(data.fiscal_document?.id || documentId)
        openNfceDanfePrint(authorizedId)
        if (authorizedId && authorizedId !== documentId) {
          router.replace(`${listHref(document.model)}/${encodeURIComponent(authorizedId)}`)
          return
        }
        await load()
        return
      }
      toast({
        title: `${kind} não autorizada`,
        description: data.fiscal_document?.sefaz_status_message || 'A SEFAZ retornou a nota sem autorização.',
        variant: 'destructive',
      })
      const nextId = String(data.fiscal_document?.id || '')
      if (nextId && nextId !== documentId) {
        router.replace(`${listHref(document.model)}/${encodeURIComponent(nextId)}`)
        return
      }
      await load()
    } finally {
      setIsSending(false)
    }
  }

  async function handleCancel () {
    const justification = await appPrompt({
      title: `Cancelar ${kind}?`,
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
    const res = await portalFetch(`/api/portal/fiscal/documents/${encodeURIComponent(documentId)}/cancel`, {
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
  }

  if (isLoading && !document) {
    return <p className='text-sm text-muted-foreground'>Carregando nota...</p>
  }

  if (!document) {
    return (
      <div className='space-y-3'>
        <p className='text-sm text-muted-foreground'>Nota fiscal não encontrada.</p>
        <Button type='button' variant='outline' onClick={() => router.push('/portal/vendas')}>
          Voltar
        </Button>
      </div>
    )
  }

  const sefazError = document.sefaz_status_message || document.sefaz_status_code
  const isCorrection = isProductFiscalCorrectionError(document.sefaz_status_code)
  const showError = document.status === 'rejected' || document.status === 'denied' || (document.status === 'pending' && Boolean(sefazError))
  const rejectionHelp = fiscalRejectionGuidance(document.sefaz_status_code, document.environment)
  const correctionTitle = document.sefaz_status_code === 'cest_not_required'
    ? 'Remova o CEST para emitir'
    : document.sefaz_status_code === 'cest_required' || document.sefaz_status_code === 'cest_mismatch'
      ? 'Ajuste o CEST para emitir'
      : document.sefaz_status_code === 'product_missing_fci'
        ? 'Informe o FCI para emitir'
        : 'Complete NCM e CEST para emitir'

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>
            {kind} série {document.series} · nº {document.number}
          </h2>
          <div className='mt-1 flex flex-wrap items-center gap-2'>
            <Badge variant={fiscalDocumentStatusBadgeVariant(document.status)}>
              {fiscalDocumentStatusLabel(document.status, document.model)}
            </Badge>
            {document.environment === 'homologacao' ? (
              <Badge variant='outline'>Homologação</Badge>
            ) : null}
            {document.order ? (
              <Link href={`/portal/vendas/${encodeURIComponent(document.order.id)}`} className='text-sm text-primary underline-offset-4 hover:underline'>
                Pedido #{document.order.order_number}
              </Link>
            ) : null}
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          {editable ? (
            <Button type='button' variant='outline' disabled={isSaving || isSending} onClick={() => void handleSave()}>
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          ) : null}
          {canSendFiscalDocument(document.status) ? (
            <Button type='button' disabled={isSaving || isSending} onClick={() => void handleSend()}>
              {isSending ? 'Enviando...' : sendLabel(document.model)}
            </Button>
          ) : null}
          {canPrintFiscalDocument(document.status) && danfeUrl ? (
            <Button
              type='button'
              variant='outline'
              onClick={() => openNfceDanfePrint(document.id)}
            >
              Imprimir DANFE
            </Button>
          ) : null}
          {canDownloadFiscalXml(document.status) && xmlUrl ? (
            <Button type='button' variant='outline' asChild>
              <a href={xmlUrl} download>Baixar XML</a>
            </Button>
          ) : null}
          {canCancelFiscalDocument(document.status) ? (
            <Button
              type='button'
              variant='outline'
              className='text-destructive hover:text-destructive'
              onClick={() => void handleCancel()}
            >
              Cancelar na SEFAZ
            </Button>
          ) : null}
          <Link href={listHref(document.model)}>
            <Button type='button' variant='outline'>Voltar</Button>
          </Link>
        </div>
      </div>

      {showError && sefazError ? (
        <Card className={isCorrection ? 'border-amber-500/40 bg-amber-500/5' : 'border-destructive/40 bg-destructive/5'}>
          <CardHeader className='pb-2'>
            <CardTitle className={isCorrection ? 'text-base' : 'text-base text-destructive'}>
              {isCorrection
                ? correctionTitle
                : document.status === 'denied' ? 'Nota denegada' : 'Nota rejeitada'}
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm'>
            <p>{document.sefaz_status_message || sefazError}</p>
            {isCorrection ? (
              <p className='text-muted-foreground'>
                Ajuste os campos nos itens abaixo e salve. O aviso some após a correção; depois envie a {kind} para a SEFAZ.
              </p>
            ) : rejectionHelp ? (
              <>
                <p className='text-muted-foreground'>{rejectionHelp.summary}</p>
                <p className='text-muted-foreground'>{rejectionHelp.hint}</p>
                {rejectionHelp.href ? (
                  <p>
                    <Link href={rejectionHelp.href} className='text-primary underline-offset-4 hover:underline'>
                      {rejectionHelp.hrefLabel || 'Abrir cadastro'}
                    </Link>
                  </p>
                ) : null}
              </>
            ) : document.status === 'denied' ? (
              <p className='text-muted-foreground'>
                O número foi consumido pela SEFAZ. Corrija os dados e envie de novo — a emissão usa o próximo número.
              </p>
            ) : (
              <p className='text-muted-foreground'>
                Corrija os dados abaixo e envie novamente. O mesmo número será reutilizado.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader><CardTitle>Destinatário</CardTitle></CardHeader>
          <CardContent className='space-y-3'>
            <div className='space-y-2'>
              <Label htmlFor='nf-customer-name'>Nome</Label>
              <Input
                id='nf-customer-name'
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={!editable}
                autoComplete='off'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='nf-customer-document'>CPF/CNPJ</Label>
              <Input
                id='nf-customer-document'
                value={customerDocument}
                onChange={(e) => setCustomerDocument(formatCpfCnpj(e.target.value))}
                disabled={!editable}
                inputMode='numeric'
                autoComplete='off'
                placeholder='Opcional para consumidor final'
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
          <CardContent className='space-y-2 text-sm'>
            <p><strong>Chave:</strong> {document.access_key || '—'}</p>
            <p><strong>Protocolo:</strong> {document.protocol || '—'}</p>
            <p><strong>Total:</strong> {document.order ? maskedFromCents(document.order.total_cents) : '—'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pagamentos</CardTitle>
          {editable ? (
            <p className='text-sm font-normal text-muted-foreground'>
              A forma de pagamento vai no XML da NFC-e. O valor da venda não pode ser alterado aqui.
            </p>
          ) : null}
        </CardHeader>
        <CardContent className='space-y-3'>
          {payments.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Nenhum pagamento nesta venda.</p>
          ) : payments.map((payment, index) => (
            <div key={payment.id} className='grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end'>
              <div className='space-y-2'>
                <Label htmlFor={`nf-payment-${payment.id}`}>
                  {payments.length > 1 ? `Pagamento ${index + 1}` : 'Forma de pagamento'}
                </Label>
                {paymentMethods.length > 0 ? (
                  <select
                    id={`nf-payment-${payment.id}`}
                    className='h-10 w-full rounded border bg-background px-2 text-sm disabled:opacity-50'
                    value={payment.paymentMethodId}
                    disabled={!editable}
                    onChange={(e) => {
                      const paymentMethodId = e.target.value
                      const method = paymentMethods.find((row) => row.id === paymentMethodId)
                      setPayments((prev) => prev.map((row) => row.id === payment.id
                        ? {
                          ...row,
                          paymentMethodId,
                          paymentMethodType: method
                            ? nfcePaymentTypeFromCatalog(method.type)
                            : row.paymentMethodType,
                        }
                        : row))
                    }}
                  >
                    {!payment.paymentMethodId ? (
                      <option value=''>Selecione a forma</option>
                    ) : paymentMethods.every((method) => method.id !== payment.paymentMethodId) ? (
                      <option value={payment.paymentMethodId}>
                        {NFCE_PAYMENT_TYPE_LABELS[payment.paymentMethodType]}
                      </option>
                    ) : null}
                    {paymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.description}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    id={`nf-payment-${payment.id}`}
                    className='h-10 w-full rounded border bg-background px-2 text-sm disabled:opacity-50'
                    value={payment.paymentMethodType}
                    disabled={!editable}
                    onChange={(e) => {
                      const paymentMethodType = e.target.value as NfcePaymentType
                      setPayments((prev) => prev.map((row) => row.id === payment.id
                        ? { ...row, paymentMethodId: '', paymentMethodType }
                        : row))
                    }}
                  >
                    {NFCE_PAYMENT_TYPES.map((type) => (
                      <option key={type} value={type}>{NFCE_PAYMENT_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                )}
              </div>
              <p className='pb-2 text-sm font-medium tabular-nums'>
                {maskedFromCents(payment.amountCents)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens da nota</CardTitle>
          {editable ? (
            <p className='text-sm font-normal text-muted-foreground'>
              NCM, CEST, origem, FCI e unidade são gravados também no cadastro do produto.
            </p>
          ) : null}
        </CardHeader>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>NCM</TableHead>
                <TableHead>CEST</TableHead>
                <TableHead>Origem</TableHead>
                {showFciColumn ? <TableHead>FCI</TableHead> : null}
                <TableHead>Un.</TableHead>
                <TableHead className='text-right'>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showFciColumn ? 8 : 7} className='py-6 text-center text-muted-foreground'>
                    Nenhum item nesta nota.
                  </TableCell>
                </TableRow>
              ) : items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className='font-medium'>{item.name}</p>
                    {item.sku ? <p className='text-xs text-muted-foreground'>{item.sku}</p> : null}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>
                    <Input
                      value={item.ncm}
                      onChange={(e) => {
                        const ncm = maskNcm(e.target.value)
                        setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, ncm } : row))
                      }}
                      disabled={!editable}
                      inputMode='numeric'
                      autoComplete='off'
                      maxLength={10}
                      placeholder='0000.00.00'
                      className='min-w-28'
                      aria-label={`NCM de ${item.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.cest}
                      onChange={(e) => {
                        const cest = maskCest(e.target.value)
                        setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, cest } : row))
                      }}
                      disabled={!editable}
                      inputMode='numeric'
                      autoComplete='off'
                      maxLength={10}
                      placeholder='00.000.00'
                      className='min-w-24'
                      aria-label={`CEST de ${item.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <select
                      className='h-10 min-w-40 rounded border bg-background px-2 text-sm disabled:opacity-50'
                      value={item.fiscalOrigin}
                      disabled={!editable}
                      aria-label={`Origem de ${item.name}`}
                      onChange={(e) => {
                        const fiscalOrigin = e.target.value
                        setItems((prev) => prev.map((row) => row.id === item.id
                          ? {
                            ...row,
                            fiscalOrigin,
                            fci: originRequiresFci(fiscalOrigin) ? row.fci : '',
                          }
                          : row))
                      }}
                    >
                      {ORIGIN_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </TableCell>
                  {showFciColumn ? (
                    <TableCell>
                      {originRequiresFci(item.fiscalOrigin) ? (
                        <Input
                          value={item.fci}
                          onChange={(e) => {
                            const fci = maskFci(e.target.value)
                            setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, fci } : row))
                          }}
                          disabled={!editable}
                          autoComplete='off'
                          spellCheck={false}
                          maxLength={36}
                          placeholder='00000000-0000-0000-0000-000000000000'
                          className='min-w-52 font-mono text-xs'
                          aria-label={`FCI de ${item.name}`}
                        />
                      ) : (
                        <span className='text-muted-foreground'>—</span>
                      )}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Input
                      value={item.fiscalUnit}
                      onChange={(e) => {
                        const fiscalUnit = e.target.value.toUpperCase().slice(0, 6)
                        setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, fiscalUnit } : row))
                      }}
                      disabled={!editable}
                      autoComplete='off'
                      className='w-16'
                      aria-label={`Unidade de ${item.name}`}
                    />
                  </TableCell>
                  <TableCell className='text-right font-medium'>{maskedFromCents(item.subtotalCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
