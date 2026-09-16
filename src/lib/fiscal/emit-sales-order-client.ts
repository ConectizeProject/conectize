import { openFiscalDanfePrint } from '@/app/(portal)/portal/vendas/SalesOrderCupomPrint'
import { toast } from '@/hooks/use-toast'
import { fiscalEmitFailureMessage } from '@/lib/fiscal/emit-failure-message'
import {
  fiscalEditorHref,
  isProductFiscalCorrectionError,
} from '@/lib/fiscal/product-fiscal-errors'
import { portalFetch } from '@/lib/portal/portal-fetch'

export type FiscalDocumentClientState = {
  id: string
  status: 'pending' | 'authorized' | 'rejected' | 'canceled' | 'denied'
  sefaz_status_code?: string | null
  sefaz_status_message?: string | null
}

export type EmitSalesOrderFiscalResult = {
  ok: boolean
  alreadyAuthorized?: boolean
  fiscalDocument: FiscalDocumentClientState | null
  danfeUrl: string | null
  xmlUrl: string | null
}

function asFiscalDocument (value: unknown): FiscalDocumentClientState | null {
  if (!value || typeof value !== 'object') return null
  const row = value as {
    id?: unknown
    status?: unknown
    sefaz_status_code?: unknown
    sefaz_status_message?: unknown
  }
  const id = String(row.id || '')
  if (!id) return null
  const rawStatus = String(row.status || 'pending')
  const status = rawStatus === 'authorized'
    || rawStatus === 'rejected'
    || rawStatus === 'canceled'
    || rawStatus === 'denied'
    ? rawStatus
    : 'pending'
  return {
    id,
    status,
    sefaz_status_code: row.sefaz_status_code == null ? null : String(row.sefaz_status_code),
    sefaz_status_message: row.sefaz_status_message == null ? null : String(row.sefaz_status_message),
  }
}

function needsFiscalEditor (doc: FiscalDocumentClientState | null) {
  if (!doc?.id) return false
  return doc.status === 'rejected'
    || doc.status === 'denied'
    || (doc.status === 'pending' && isProductFiscalCorrectionError(doc.sefaz_status_code))
}

function xmlUrlFor (doc: FiscalDocumentClientState | null) {
  if (!doc?.id) return null
  if (doc.status !== 'authorized' && doc.status !== 'canceled') return null
  return `/api/portal/fiscal/documents/${encodeURIComponent(doc.id)}/xml`
}

function danfeUrlFor (doc: FiscalDocumentClientState | null, fromApi?: unknown) {
  if (typeof fromApi === 'string' && fromApi.trim()) return fromApi
  if (!doc?.id || doc.status !== 'authorized') return null
  return `/api/portal/fiscal/documents/${encodeURIComponent(doc.id)}/danfe`
}

export async function emitServiceOrderNfe (input: {
  orderId: string
  displayNumber: string | number
  navigate: (href: string) => void
}): Promise<EmitSalesOrderFiscalResult> {
  return emitSalesOrderFiscalDocument({
    orderId: input.orderId,
    model: '55',
    navigate: input.navigate,
    emitApiBase: `/api/portal/ordens/${encodeURIComponent(input.orderId)}`,
    customerHref: `/portal/ordens/${encodeURIComponent(String(input.displayNumber))}`,
  })
}

export async function emitSalesOrderFiscalDocument (input: {
  orderId: string
  model: '55' | '65'
  paid?: boolean
  navigate: (href: string) => void
  emitApiBase?: string
  customerHref?: string
}): Promise<EmitSalesOrderFiscalResult> {
  const kind = input.model === '55' ? 'NF-e' : 'NFC-e'
  const emitPath = input.model === '55' ? 'emit-nfe' : 'emit-nfce'
  const apiBase = input.emitApiBase || `/api/portal/sales-orders/${encodeURIComponent(input.orderId)}`
  const customerHref = input.customerHref || `/portal/vendas/${encodeURIComponent(input.orderId)}`
  const empty: EmitSalesOrderFiscalResult = {
    ok: false,
    fiscalDocument: null,
    danfeUrl: null,
    xmlUrl: null,
  }

  if (input.paid === false) {
    toast({
      title: 'Venda ainda não está paga',
      description: `A ${kind} só pode ser emitida para vendas pagas.`,
      variant: 'destructive',
    })
    return empty
  }

  const stateRes = await portalFetch(`${apiBase}/${emitPath}`)
  const stateData = await stateRes?.json().catch(() => null) as {
    ok?: boolean
    fiscal_document?: unknown
    danfe_url?: unknown
    xml_url?: unknown
  } | null
  const fiscalDocument = asFiscalDocument(stateData?.fiscal_document)

  if (needsFiscalEditor(fiscalDocument) && fiscalDocument) {
    input.navigate(fiscalEditorHref(input.model, fiscalDocument.id, {
      corrigir: isProductFiscalCorrectionError(fiscalDocument.sefaz_status_code),
    }))
    return {
      ok: false,
      fiscalDocument,
      danfeUrl: danfeUrlFor(fiscalDocument, stateData?.danfe_url),
      xmlUrl: typeof stateData?.xml_url === 'string' ? stateData.xml_url : xmlUrlFor(fiscalDocument),
    }
  }

  if (stateData?.danfe_url && fiscalDocument?.id) {
    toast({
      variant: 'success',
      title: `${kind} já autorizada`,
      description: `Abrindo a ${kind} para impressão.`,
    })
    openFiscalDanfePrint(fiscalDocument.id, input.model)
    return {
      ok: true,
      alreadyAuthorized: true,
      fiscalDocument,
      danfeUrl: danfeUrlFor(fiscalDocument, stateData.danfe_url),
      xmlUrl: typeof stateData.xml_url === 'string' ? stateData.xml_url : xmlUrlFor(fiscalDocument),
    }
  }

  const endpoint = fiscalDocument?.id && fiscalDocument.status !== 'authorized'
    ? `/api/portal/fiscal/documents/${encodeURIComponent(fiscalDocument.id)}/retry`
        : `${apiBase}/${emitPath}`

  const res = await portalFetch(endpoint, { method: 'POST' })
  const data = await res?.json().catch(() => null) as {
    ok?: boolean
    error?: string
    message?: string
    needs_correction?: boolean
    already_authorized?: boolean
    fiscal_document?: unknown
    danfe_url?: unknown
    xml_url?: unknown
  } | null
  const nextFiscalDocument = asFiscalDocument(data?.fiscal_document)
  const nextDanfeUrl = danfeUrlFor(nextFiscalDocument, data?.danfe_url)
  const nextXmlUrl = typeof data?.xml_url === 'string' ? data.xml_url : xmlUrlFor(nextFiscalDocument)

  if (!data?.ok) {
    if (data?.error === 'nfe_customer_required'
      || data?.error === 'nfe_customer_address_required'
      || data?.error === 'nfe_customer_ibge_required') {
      toast({
        title: 'Complete o destinatário',
        description: data.message || (customerHref.includes('/portal/ordens/')
          ? 'A NF-e exige cliente com CPF/CNPJ e endereço completo na OS.'
          : 'A NF-e exige cliente com CPF/CNPJ e endereço completo.'),
      })
      input.navigate(customerHref)
      return { ok: false, fiscalDocument: nextFiscalDocument, danfeUrl: nextDanfeUrl, xmlUrl: nextXmlUrl }
    }
    if (data?.needs_correction && nextFiscalDocument?.id) {
      toast({
        title: 'Complete NCM e CEST',
        description: data.message || `Preencha os dados fiscais dos produtos para emitir a ${kind}.`,
      })
      input.navigate(fiscalEditorHref(input.model, nextFiscalDocument.id, { corrigir: true }))
      return { ok: false, fiscalDocument: nextFiscalDocument, danfeUrl: nextDanfeUrl, xmlUrl: nextXmlUrl }
    }
    toast({
      title: `${kind} não autorizada`,
      description: fiscalEmitFailureMessage(res, data, kind),
      variant: 'destructive',
    })
    if (nextFiscalDocument?.id) {
      input.navigate(fiscalEditorHref(input.model, nextFiscalDocument.id))
    }
    return { ok: false, fiscalDocument: nextFiscalDocument, danfeUrl: nextDanfeUrl, xmlUrl: nextXmlUrl }
  }

  if (data.danfe_url && nextFiscalDocument?.id) {
    toast({
      variant: 'success',
      title: data.already_authorized ? `${kind} já autorizada` : `${kind} autorizada`,
      description: `Abrindo a ${kind} para impressão.`,
    })
    openFiscalDanfePrint(nextFiscalDocument.id, input.model)
    return {
      ok: true,
      alreadyAuthorized: Boolean(data.already_authorized),
      fiscalDocument: nextFiscalDocument,
      danfeUrl: nextDanfeUrl,
      xmlUrl: nextXmlUrl,
    }
  }

  toast({
    title: `${kind} não autorizada`,
    description: nextFiscalDocument?.sefaz_status_message
      || nextFiscalDocument?.sefaz_status_code
      || 'A SEFAZ retornou a nota sem autorização.',
    variant: 'destructive',
  })
  if (nextFiscalDocument?.id) {
    input.navigate(fiscalEditorHref(input.model, nextFiscalDocument.id))
  }
  return { ok: false, fiscalDocument: nextFiscalDocument, danfeUrl: nextDanfeUrl, xmlUrl: nextXmlUrl }
}
