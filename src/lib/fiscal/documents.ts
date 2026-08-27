import 'server-only'
import type { PortalAuthStaffSuccess } from '@/lib/auth/portal-api'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { toDbCustomerType } from '@/lib/sales-orders/customer-type'
import { onlyDigits } from '@/lib/utils/strings'
import { nfeXmlText, NFE_XNOME_MAX } from '@/lib/fiscal/xml-strings'
import { customerStateRegistrationPatch } from '@/lib/customers/state-registration'
import {
  canDeleteFiscalDocument,
  canEditFiscalDocument,
  fiscalDocumentKind,
  type FiscalDocumentStatus,
} from '@/lib/fiscal/document-status'
import { nfceNumberRestorePatch, nfeNumberRestorePatch } from '@/lib/fiscal/numbering'
import { validateCestNcmPair } from '@/lib/fiscal/cest-lookup'
import { normalizeOptionalFci, originRequiresFci } from '@/lib/fiscal/fci'
import { normalizeOptionalCest, normalizeOptionalNcm } from '@/lib/fiscal/ncm'
import { isProductFiscalCorrectionError } from '@/lib/fiscal/product-fiscal-errors'
import { updateProduct } from '@/lib/products/service'
import { syncSalesOrderFinancialTransactions } from '@/lib/finance/service-order-financial-sync'
import {
  isNfcePaymentType,
  nfcePaymentTypeFromCatalog,
  type NfcePaymentType,
} from '@/lib/fiscal/payment-method-type'
import type {
  FiscalDocumentDetail,
  FiscalDocumentItemRow,
  FiscalDocumentListRow,
  FiscalDocumentPaymentRow,
} from '@/lib/fiscal/document-types'
import { vendasListPage, vendasListRange } from '@/lib/vendas/list-pagination'

export type {
  FiscalDocumentDetail,
  FiscalDocumentItemRow,
  FiscalDocumentListRow,
} from '@/lib/fiscal/document-types'

type AuthCtx = PortalAuthStaffSuccess

type ListInput = {
  model: '55' | '65'
  status?: string
  from?: string
  to?: string
  page?: number
}

function asStatus (value: unknown): FiscalDocumentStatus {
  if (value === 'authorized' || value === 'pending' || value === 'rejected' || value === 'canceled' || value === 'denied') {
    return value
  }
  return 'pending'
}

function asModel (value: unknown): '55' | '65' {
  return value === '55' ? '55' : '65'
}

function productRecord (raw: unknown) {
  if (!raw || typeof raw !== 'object') return null
  const row = Array.isArray(raw) ? raw[0] : raw
  if (!row || typeof row !== 'object') return null
  return row as Record<string, unknown>
}

export async function listFiscalDocuments (auth: AuthCtx, input: ListInput) {
  const paginated = Number.isFinite(input.page)
  const page = paginated ? vendasListPage(String(input.page)) : 1
  const { from: rangeFrom, to: rangeTo, pageSize } = vendasListRange(page)

  let query = auth.supabase
    .from('fiscal_documents')
    .select('id, model, environment, series, number, status, access_key, protocol, sefaz_status_code, sefaz_status_message, sales_order_id, created_at, authorized_at', { count: 'exact' })
    .eq('organization_id', auth.organizationId)
    .eq('model', input.model)
    .order('created_at', { ascending: false })

  if (paginated) query = query.range(rangeFrom, rangeTo)
  else query = query.limit(200)

  if (input.status) query = query.eq('status', input.status)
  if (input.from) query = query.gte('created_at', `${input.from}T00:00:00`)
  if (input.to) query = query.lte('created_at', `${input.to}T23:59:59.999`)

  const { data, error, count } = await query
  if (error) return { ok: false as const, error: 'db_error' as const }

  const docs = data ?? []
  const orderIds = [...new Set(docs.map((row) => String(row.sales_order_id || '')).filter(Boolean))]
  const ordersById = new Map<string, { order_number: number, customer_name: string | null, total_cents: number | null }>()

  if (orderIds.length > 0) {
    const { data: orders, error: ordersError } = await auth.supabase
      .from('sales_orders')
      .select('id, order_number, customer_name, total_cents')
      .eq('organization_id', auth.organizationId)
      .in('id', orderIds)
    if (ordersError) return { ok: false as const, error: 'db_error' as const }
    for (const order of orders ?? []) {
      ordersById.set(String(order.id), {
        order_number: Number(order.order_number) || 0,
        customer_name: order.customer_name ? String(order.customer_name) : null,
        total_cents: Number(order.total_cents) || 0,
      })
    }
  }

  const documents: FiscalDocumentListRow[] = docs.map((row) => {
    const order = row.sales_order_id ? ordersById.get(String(row.sales_order_id)) : null
    return {
      id: String(row.id),
      model: asModel(row.model),
      environment: row.environment === 'producao' ? 'producao' : 'homologacao',
      series: Number(row.series) || 1,
      number: Number(row.number) || 0,
      status: asStatus(row.status),
      access_key: row.access_key ? String(row.access_key) : null,
      protocol: row.protocol ? String(row.protocol) : null,
      sefaz_status_code: row.sefaz_status_code ? String(row.sefaz_status_code) : null,
      sefaz_status_message: row.sefaz_status_message ? String(row.sefaz_status_message) : null,
      sales_order_id: row.sales_order_id ? String(row.sales_order_id) : null,
      order_number: order?.order_number ?? null,
      customer_name: order?.customer_name ?? null,
      total_cents: order?.total_cents ?? null,
      created_at: String(row.created_at),
      authorized_at: row.authorized_at ? String(row.authorized_at) : null,
    }
  })

  return {
    ok: true as const,
    documents,
    total: count ?? 0,
    page,
    pageSize: paginated ? pageSize : 200,
  }
}

export async function loadFiscalDocumentDetail (auth: AuthCtx, fiscalDocumentId: string) {
  const { data, error } = await auth.supabase
    .from('fiscal_documents')
    .select('id, model, environment, series, number, status, access_key, protocol, qr_code_url, sefaz_status_code, sefaz_status_message, sales_order_id, authorized_at, canceled_at, created_at')
    .eq('organization_id', auth.organizationId)
    .eq('id', fiscalDocumentId)
    .maybeSingle()

  if (error) return { ok: false as const, error: 'db_error' as const }
  if (!data) return { ok: false as const, error: 'not_found' as const }

  let order: FiscalDocumentDetail['order'] = null
  let items: FiscalDocumentItemRow[] = []
  let payments: FiscalDocumentPaymentRow[] = []

  if (data.sales_order_id) {
    const [{ data: orderRow, error: orderError }, { data: itemRows, error: itemsError }, { data: paymentRows, error: paymentsError }] = await Promise.all([
      auth.supabase
        .from('sales_orders')
        .select('id, order_number, status, customer_name, customer_type, customer_document, total_cents, paid_amount_cents, change_cents')
        .eq('organization_id', auth.organizationId)
        .eq('id', data.sales_order_id)
        .maybeSingle(),
      auth.supabase
        .from('sales_order_items')
        .select('id, product_id, quantity, unit_price_cents, discount_cents, subtotal_cents, products(id, name, sku, ncm, cest, fiscal_origin, fci, fiscal_unit)')
        .eq('organization_id', auth.organizationId)
        .eq('sales_order_id', data.sales_order_id)
        .order('created_at', { ascending: true }),
      auth.supabase
        .from('sales_order_payments')
        .select('id, payment_method_id, payment_method_type, amount_cents')
        .eq('organization_id', auth.organizationId)
        .eq('sales_order_id', data.sales_order_id)
        .order('created_at', { ascending: true }),
    ])

    if (orderError || itemsError || paymentsError) return { ok: false as const, error: 'db_error' as const }

    if (orderRow) {
      const documentDigits = onlyDigits(String(orderRow.customer_document || ''))
      let customerIe: { state_registration?: string | null, state_registration_exempt?: boolean | null } | null = null
      if (documentDigits.length === 11 || documentDigits.length === 14) {
        const { data: customerRow } = await auth.supabase
          .from('customers')
          .select('state_registration, state_registration_exempt')
          .eq('organization_id', auth.organizationId)
          .or(`cpf.eq.${documentDigits},cnpj.eq.${documentDigits}`)
          .limit(1)
          .maybeSingle()
        customerIe = customerRow
      }

      order = {
        id: String(orderRow.id),
        order_number: Number(orderRow.order_number) || 0,
        status: String(orderRow.status || ''),
        customer_name: orderRow.customer_name ? String(orderRow.customer_name) : null,
        customer_type: orderRow.customer_type ? String(orderRow.customer_type) : null,
        customer_document: orderRow.customer_document ? String(orderRow.customer_document) : null,
        customer_state_registration: customerIe?.state_registration ? String(customerIe.state_registration) : null,
        customer_state_registration_exempt: customerIe?.state_registration_exempt === true,
        total_cents: Number(orderRow.total_cents) || 0,
      }
    }

    items = (itemRows ?? []).map((item) => {
      const product = productRecord(item.products)
      return {
        id: String(item.id),
        product_id: String(item.product_id),
        name: product?.name ? String(product.name) : 'Produto',
        sku: product?.sku ? String(product.sku) : null,
        quantity: Number(item.quantity) || 1,
        unit_price_cents: Number(item.unit_price_cents) || 0,
        discount_cents: Number(item.discount_cents) || 0,
        subtotal_cents: Number(item.subtotal_cents) || 0,
        ncm: product?.ncm ? String(product.ncm) : null,
        cest: product?.cest ? String(product.cest) : null,
        fiscal_origin: product?.fiscal_origin == null ? null : Number(product.fiscal_origin),
        fci: product?.fci ? String(product.fci) : null,
        fiscal_unit: product?.fiscal_unit ? String(product.fiscal_unit) : null,
      }
    })

    payments = (paymentRows ?? []).map((payment) => ({
      id: String(payment.id),
      payment_method_id: payment.payment_method_id ? String(payment.payment_method_id) : null,
      payment_method_type: String(payment.payment_method_type || 'outro'),
      amount_cents: Number(payment.amount_cents) || 0,
    }))
  }

  const detail: FiscalDocumentDetail = {
    id: String(data.id),
    model: asModel(data.model),
    environment: data.environment === 'producao' ? 'producao' : 'homologacao',
    series: Number(data.series) || 1,
    number: Number(data.number) || 0,
    status: asStatus(data.status),
    access_key: data.access_key ? String(data.access_key) : null,
    protocol: data.protocol ? String(data.protocol) : null,
    qr_code_url: data.qr_code_url ? String(data.qr_code_url) : null,
    sefaz_status_code: data.sefaz_status_code ? String(data.sefaz_status_code) : null,
    sefaz_status_message: data.sefaz_status_message ? String(data.sefaz_status_message) : null,
    sales_order_id: data.sales_order_id ? String(data.sales_order_id) : null,
    authorized_at: data.authorized_at ? String(data.authorized_at) : null,
    canceled_at: data.canceled_at ? String(data.canceled_at) : null,
    created_at: String(data.created_at),
    order,
    items,
    payments,
  }

  return { ok: true as const, document: detail }
}

export type FiscalDocumentDraftInput = {
  customerName?: string
  customerDocument?: string
  customerStateRegistration?: string
  customerStateRegistrationExempt?: boolean
  items?: Array<{
    productId: string
    ncm?: string | null
    cest?: string | null
    fiscalOrigin?: number | null
    fci?: string | null
    fiscalUnit?: string | null
  }>
  payments?: Array<{
    id: string
    paymentMethodId?: string | null
    paymentMethodType?: string | null
  }>
}

export async function updateFiscalDocumentDraft (
  auth: AuthCtx,
  fiscalDocumentId: string,
  input: FiscalDocumentDraftInput,
) {
  const loaded = await loadFiscalDocumentDetail(auth, fiscalDocumentId)
  if (!loaded.ok) return loaded
  const doc = loaded.document

  if (!canEditFiscalDocument(doc.status)) {
    return { ok: false as const, error: 'not_editable' as const, message: 'Somente notas pendentes, rejeitadas ou denegadas podem ser corrigidas.' }
  }
  if (!doc.order) {
    return { ok: false as const, error: 'order_not_found' as const, message: 'Pedido da nota não encontrado.' }
  }
  if (doc.order.status !== 'in_progress' && doc.order.status !== 'paid') {
    return { ok: false as const, error: 'order_not_editable' as const, message: 'Este pedido não pode ser editado.' }
  }

  const orderPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.customerName !== undefined) {
    const name = String(input.customerName || '').trim()
    orderPatch.customer_name = nfeXmlText(name, NFE_XNOME_MAX) || 'Consumidor Final'
  }
  if (input.customerDocument !== undefined) {
    const digits = onlyDigits(input.customerDocument)
    orderPatch.customer_document = digits || null
    if (digits.length === 14) orderPatch.customer_type = toDbCustomerType('pj')
    else if (digits.length === 11) orderPatch.customer_type = toDbCustomerType('pf')
  }

  if (Object.keys(orderPatch).length > 1) {
    const { error } = await auth.supabase
      .from('sales_orders')
      .update(orderPatch)
      .eq('organization_id', auth.organizationId)
      .eq('id', doc.order.id)
    if (error) return { ok: false as const, error: 'db_error' as const }
  }

  const ieTouched = input.customerStateRegistration !== undefined
    || input.customerStateRegistrationExempt !== undefined
  if (doc.model === '55' && ieTouched) {
    const digits = onlyDigits(
      input.customerDocument !== undefined
        ? input.customerDocument
        : (doc.order.customer_document || ''),
    )
    if (digits.length === 11 || digits.length === 14) {
      const { data: customerRow, error: customerLookupError } = await auth.supabase
        .from('customers')
        .select('id, is_company, state')
        .eq('organization_id', auth.organizationId)
        .or(`cpf.eq.${digits},cnpj.eq.${digits}`)
        .limit(1)
        .maybeSingle()
      if (customerLookupError) return { ok: false as const, error: 'db_error' as const }
      if (!customerRow?.id) {
        return {
          ok: false as const,
          error: 'nfe_customer_not_found' as const,
          message: 'Selecione um cliente cadastrado para informar a inscrição estadual na NF-e.',
        }
      }

      const iePatch = customerStateRegistrationPatch({
        isCompany: Boolean(customerRow.is_company) || digits.length === 14,
        stateRegistration: input.customerStateRegistration,
        stateRegistrationExempt: input.customerStateRegistrationExempt,
        uf: customerRow.state ? String(customerRow.state) : null,
      })
      const { error: customerUpdateError } = await auth.supabase
        .from('customers')
        .update(iePatch)
        .eq('organization_id', auth.organizationId)
        .eq('id', customerRow.id)
      if (customerUpdateError) return { ok: false as const, error: 'db_error' as const }
    }
  }

  const itemInputs = Array.isArray(input.items) ? input.items : []
  const allowedProductIds = new Set(doc.items.map((item) => item.product_id))
  const seen = new Set<string>()

  for (const item of itemInputs) {
    const productId = String(item.productId || '').trim()
    if (!productId) {
      return {
        ok: false as const,
        error: 'product_not_found' as const,
        message: 'Um item da nota não tem produto vinculado para gravar NCM/CEST.',
      }
    }
    if (!allowedProductIds.has(productId)) {
      return {
        ok: false as const,
        error: 'product_not_found' as const,
        message: 'Um item da nota aponta para um produto que não pertence a este pedido.',
      }
    }
    if (seen.has(productId)) continue
    seen.add(productId)

    const ncm = item.ncm !== undefined ? normalizeOptionalNcm(item.ncm) : undefined
    if (ncm === 'invalid') {
      return { ok: false as const, error: 'invalid_ncm' as const, message: 'Informe o NCM com 8 dígitos (0000.00.00) ou deixe em branco.' }
    }
    const cest = item.cest !== undefined ? normalizeOptionalCest(item.cest) : undefined
    if (cest === 'invalid') {
      return { ok: false as const, error: 'invalid_cest' as const, message: 'Informe o CEST com 7 dígitos (00.000.00) ou deixe em branco.' }
    }

    const currentItem = doc.items.find((row) => row.product_id === productId)
    const ncmForPair = ncm !== undefined ? ncm : (currentItem?.ncm ?? null)
    const cestForPair = cest !== undefined ? cest : (currentItem?.cest ?? null)
    const cestPair = await validateCestNcmPair(ncmForPair, cestForPair, currentItem?.name)
    if (cestPair.ok === false) {
      return { ok: false as const, error: cestPair.error, message: cestPair.message }
    }

    const productPatch: {
      ncm?: string | null
      cest?: string | null
      fiscalOrigin?: number | null
      fci?: string | null
      fiscalUnit?: string | null
    } = {}
    if (ncm !== undefined) productPatch.ncm = ncm
    if (cest !== undefined) productPatch.cest = cest
    if (item.fiscalOrigin !== undefined) {
      const origin = Number(item.fiscalOrigin)
      if (!Number.isFinite(origin) || origin < 0 || origin > 8) {
        return { ok: false as const, error: 'invalid_origin' as const, message: 'Origem fiscal inválida.' }
      }
      productPatch.fiscalOrigin = Math.round(origin)
    }
    const originForFci = productPatch.fiscalOrigin ?? doc.items.find((row) => row.product_id === productId)?.fiscal_origin
    if (item.fci !== undefined || item.fiscalOrigin !== undefined) {
      if (!originRequiresFci(originForFci)) {
        productPatch.fci = null
      } else {
        const fci = normalizeOptionalFci(item.fci)
        if (fci === 'invalid' || fci == null) {
          return {
            ok: false as const,
            error: 'invalid_fci' as const,
            message: 'Informe o FCI no formato UUID (8-4-4-4-12) para origens 3, 5 ou 8.',
          }
        }
        productPatch.fci = fci
      }
    }
    if (item.fiscalUnit !== undefined) {
      const unit = String(item.fiscalUnit || '').trim().toUpperCase().slice(0, 6)
      productPatch.fiscalUnit = unit || null
    }

    if (Object.keys(productPatch).length === 0) continue

    const updated = await updateProduct(productId, productPatch)
    if (!updated.ok) {
      return {
        ok: false as const,
        error: 'product_update_failed' as const,
        message: 'Não foi possível gravar os dados fiscais no cadastro do produto.',
      }
    }
  }

  if (input.payments) {
    const paymentsResult = await applyFiscalDocumentPayments(auth, doc, input.payments)
    if (paymentsResult.ok === false) return paymentsResult
  }

  // Correção de NCM/CEST/FCI já validada nos itens: some o aviso antigo da tela.
  if (itemInputs.length > 0 && isProductFiscalCorrectionError(doc.sefaz_status_code)) {
    const { error: clearError } = await auth.supabase
      .from('fiscal_documents')
      .update({
        sefaz_status_code: null,
        sefaz_status_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fiscalDocumentId)
      .eq('organization_id', auth.organizationId)
    if (clearError) {
      console.error('[fiscal] clear product correction status', clearError)
    }
  }

  return loadFiscalDocumentDetail(auth, fiscalDocumentId)
}

async function applyFiscalDocumentPayments (
  auth: AuthCtx,
  doc: FiscalDocumentDetail,
  paymentInputs: NonNullable<FiscalDocumentDraftInput['payments']>,
) {
  if (!doc.order) {
    return { ok: false as const, error: 'order_not_found' as const, message: 'Pedido da nota não encontrado.' }
  }
  if (paymentInputs.length !== doc.payments.length) {
    return {
      ok: false as const,
      error: 'invalid_payments' as const,
      message: 'A quantidade de pagamentos não pode ser alterada nesta tela.',
    }
  }

  const currentById = new Map(doc.payments.map((row) => [row.id, row]))
  const seen = new Set<string>()
  for (const row of paymentInputs) {
    const id = String(row.id || '').trim()
    if (!id || !currentById.has(id) || seen.has(id)) {
      return {
        ok: false as const,
        error: 'invalid_payments' as const,
        message: 'Um pagamento da nota não foi encontrado.',
      }
    }
    seen.add(id)
  }

  const { data: methods, error: methodsError } = await auth.supabase
    .from('payment_methods')
    .select('id, type')
    .eq('organization_id', auth.organizationId)
  if (methodsError) return { ok: false as const, error: 'db_error' as const }

  const catalog = (methods ?? []).map((row) => ({
    id: String(row.id),
    type: nfcePaymentTypeFromCatalog(row.type),
  }))
  const catalogById = new Map(catalog.map((row) => [row.id, row]))

  const resolved: Array<{
    id: string
    paymentMethodId: string | null
    paymentMethodType: NfcePaymentType
    amountCents: number
  }> = []

  for (const input of paymentInputs) {
    const current = currentById.get(String(input.id))
    if (!current) {
      return {
        ok: false as const,
        error: 'invalid_payments' as const,
        message: 'Um pagamento da nota não foi encontrado.',
      }
    }

    const requestedMethodId = input.paymentMethodId === undefined
      ? undefined
      : (String(input.paymentMethodId || '').trim() || null)
    let paymentMethodId = current.payment_method_id
    let paymentMethodType: NfcePaymentType = isNfcePaymentType(current.payment_method_type)
      ? current.payment_method_type
      : 'outro'

    if (requestedMethodId) {
      const method = catalogById.get(requestedMethodId)
      if (method) {
        paymentMethodId = method.id
        paymentMethodType = method.type
      } else if (isNfcePaymentType(input.paymentMethodType)) {
        paymentMethodType = input.paymentMethodType
        paymentMethodId = catalog.find((row) => row.type === paymentMethodType)?.id ?? null
      } else {
        return {
          ok: false as const,
          error: 'invalid_payment_method' as const,
          message: 'Forma de pagamento inválida.',
        }
      }
    } else if (input.paymentMethodType != null) {
      if (!isNfcePaymentType(input.paymentMethodType)) {
        return {
          ok: false as const,
          error: 'invalid_payment_method' as const,
          message: 'Forma de pagamento inválida.',
        }
      }
      paymentMethodType = input.paymentMethodType
      const currentMethod = paymentMethodId ? catalogById.get(paymentMethodId) : null
      if (!currentMethod || currentMethod.type !== paymentMethodType) {
        paymentMethodId = catalog.find((row) => row.type === paymentMethodType)?.id ?? null
      }
    }

    resolved.push({
      id: current.id,
      paymentMethodId,
      paymentMethodType,
      amountCents: current.amount_cents,
    })
  }

  for (const row of resolved) {
    const { error } = await auth.supabase
      .from('sales_order_payments')
      .update({
        payment_method_id: row.paymentMethodId,
        payment_method_type: row.paymentMethodType,
      })
      .eq('organization_id', auth.organizationId)
      .eq('id', row.id)
    if (error) return { ok: false as const, error: 'db_error' as const }
  }

  const hasCash = resolved.some((row) => row.paymentMethodType === 'dinheiro')
  const paidAmount = resolved.reduce((sum, row) => sum + row.amountCents, 0)
  const total = doc.order.total_cents
  const change = hasCash ? Math.max(0, paidAmount - total) : 0
  const { error: orderError } = await auth.supabase
    .from('sales_orders')
    .update({
      change_cents: change,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('id', doc.order.id)
  if (orderError) return { ok: false as const, error: 'db_error' as const }

  if (doc.order.status === 'paid') {
    try {
      await syncSalesOrderFinancialTransactions({
        supabase: auth.supabase,
        organizationId: auth.organizationId,
        orderId: doc.order.id,
        orderRow: {
          id: doc.order.id,
          organization_id: auth.organizationId,
          order_number: doc.order.order_number ?? null,
          status: 'paid',
          updated_at: new Date().toISOString(),
          change_cents: change,
          total_cents: total,
        },
      })
    } catch (err) {
      console.error('[fiscal payments] finance sync failed', err)
      return {
        ok: false as const,
        error: 'finance_sync_failed' as const,
        message: 'A forma de pagamento foi gravada, mas o financeiro não foi atualizado.',
      }
    }
  }

  return { ok: true as const }
}

function deleteBlockedMessage (
  status: FiscalDocumentStatus,
  accessKey: string | null,
  kind: string,
) {
  if (status === 'authorized') {
    return `${kind} autorizada não pode ser excluída. Cancele na SEFAZ se ainda estiver no prazo.`
  }
  if (status === 'denied') {
    return `${kind} denegada consome o número na SEFAZ e não pode ser excluída.`
  }
  if (status === 'canceled') {
    return `${kind} cancelada permanece no histórico e não pode ser excluída.`
  }
  if (status === 'pending' && String(accessKey || '').trim()) {
    return `Esta ${kind} já foi enviada à SEFAZ e ainda não teve retorno definitivo. Consulte ou envie de novo; não é possível excluir.`
  }
  return `Somente rascunho (não enviado) ou ${kind} rejeitada podem ser excluídos.`
}

async function restoreAllocatedNumber (input: {
  organizationId: string
  model: '55' | '65'
  environment: 'homologacao' | 'producao'
  series: number
  number: number
}) {
  const service = createSupabaseServiceClient()
  const { data: profile, error } = await service
    .from('organization_fiscal_profiles')
    .select('fiscal_environment, nfe_series, nfe_next_number, nfce_series, nfce_next_number, nfce_series_homologacao, nfce_next_number_homologacao, nfce_series_producao, nfce_next_number_producao')
    .eq('organization_id', input.organizationId)
    .maybeSingle()
  if (error || !profile) {
    if (error) console.error('[fiscal] restoreAllocatedNumber load', error)
    return
  }

  const patch = input.model === '55'
    ? nfeNumberRestorePatch(profile, input.series, input.number)
    : nfceNumberRestorePatch(
      profile,
      input.environment,
      input.series,
      input.number,
    )
  if (!patch) return

  const { error: updateError } = await service
    .from('organization_fiscal_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('organization_id', input.organizationId)
  if (updateError) {
    console.error('[fiscal] restoreAllocatedNumber update', updateError)
  }
}

export async function deleteFiscalDocument (auth: AuthCtx, fiscalDocumentId: string) {
  const { data, error } = await auth.supabase
    .from('fiscal_documents')
    .select('id, model, environment, series, number, status, access_key')
    .eq('organization_id', auth.organizationId)
    .eq('id', fiscalDocumentId)
    .maybeSingle()

  if (error) return { ok: false as const, error: 'db_error' as const }
  if (!data) return { ok: false as const, error: 'not_found' as const }

  const model = data.model === '55' ? '55' as const : '65' as const
  const kind = fiscalDocumentKind(model)
  if (model !== '55') {
    return {
      ok: false as const,
      error: 'not_deletable' as const,
      message: 'Somente NF-e pendente ou rejeitada pode ser excluída.',
    }
  }
  const status = asStatus(data.status)
  const accessKey = data.access_key ? String(data.access_key) : null

  if (!canDeleteFiscalDocument(status, accessKey)) {
    return {
      ok: false as const,
      error: 'not_deletable' as const,
      message: deleteBlockedMessage(status, accessKey, kind),
    }
  }

  const service = createSupabaseServiceClient()
  const { error: deleteError } = await service
    .from('fiscal_documents')
    .delete()
    .eq('organization_id', auth.organizationId)
    .eq('id', fiscalDocumentId)

  if (deleteError) {
    console.error('[fiscal] deleteFiscalDocument', deleteError)
    return { ok: false as const, error: 'db_error' as const }
  }

  await restoreAllocatedNumber({
    organizationId: auth.organizationId,
    model,
    environment: data.environment === 'producao' ? 'producao' : 'homologacao',
    series: Number(data.series) || 1,
    number: Number(data.number) || 0,
  })

  return { ok: true as const }
}
