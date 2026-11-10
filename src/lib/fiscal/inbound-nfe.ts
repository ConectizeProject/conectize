import 'server-only'
import type { PortalAuthStaffSuccess } from '@/lib/auth/portal-api'
import { inboundNfeItemStockExternalReference } from '@/lib/fiscal/inbound-nfe-stock-ref'
import { parseInboundNfeXml } from '@/lib/fiscal/parse-inbound-nfe-xml'
import { syncResaleDevicePurchaseFinancialTransactions } from '@/lib/finance/service-order-financial-sync'
import {
  coerceRawSalePaymentsToArray,
  mapLooseEntryToSalePaymentRow,
} from '@/lib/resale/sale-payment-methods'
import { syncAmountRowsToTotal } from '@/lib/fiscal/sync-payment-amounts'
import { onlyDigits } from '@/lib/utils/strings'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

type AuthCtx = PortalAuthStaffSuccess

export type InboundNfeStatus = 'draft' | 'posted' | 'canceled'
export type InboundEntryKind = 'products' | 'used_devices'
export type InboundSourceMode = 'xml' | 'manual'
export type InboundItemKind = 'product' | 'used_device'
export type InboundFiscalPurpose = 'resale' | 'fixed_asset' | 'use_consumption'
export type InboundEntryType = 'own_issuance' | 'third_party' | 'import' | 'xml_import'
export type InboundFiscalPayment = { type: string, value_cents: number }

export type UsedDeviceSnapshot = {
  device_name: string
  color?: string | null
  storage_gb?: string | null
  battery?: string | null
  condition?: string | null
  info?: string | null
  imei?: string | null
  imei2?: string | null
  serial?: string | null
  sale_value_cents?: number | null
}

export type InboundNfeItemRow = {
  id: string
  line_number: number
  item_kind: InboundItemKind
  product_code: string | null
  barcode: string | null
  description: string
  ncm: string | null
  cest: string | null
  unit: string | null
  cfop: string | null
  fiscal_origin: number | null
  icms_csosn: string | null
  icms_cst: string | null
  pis_cst: string | null
  cofins_cst: string | null
  ipi_cst: string | null
  quantity: number
  unit_value_cents: number
  total_cents: number
  product_id: string | null
  stock_movement_id: string | null
  resale_device_id: string | null
  device_snapshot: UsedDeviceSnapshot | null
  product?: {
    id: string
    name: string
    sku: string | null
    barcode: string | null
  } | null
}

export type InboundNfeDocumentRow = {
  id: string
  entry_kind: InboundEntryKind
  source_mode: InboundSourceMode
  entry_type: InboundEntryType
  access_key: string | null
  series: number
  number: number
  issued_at: string | null
  issuer_cnpj: string | null
  issuer_name: string | null
  recipient_cnpj: string | null
  recipient_name: string | null
  seller_customer_id: string | null
  seller_name: string | null
  seller_document: string | null
  fiscal_purpose: InboundFiscalPurpose
  should_move_stock: boolean
  operation_nature: string
  freight_cents: number
  insurance_cents: number
  other_expenses_cents: number
  discount_cents: number
  transport_mode: 'none' | 'buyer' | 'seller' | 'carrier'
  complementary_information: string | null
  fiscal_information: string | null
  fiscal_payments: InboundFiscalPayment[]
  purchase_payment_methods: unknown
  total_cents: number
  status: InboundNfeStatus
  notes: string | null
  posted_at: string | null
  created_at: string
  updated_at: string
  fiscal_document?: {
    id: string
    status: string
    series: number
    number: number
    access_key: string | null
    sefaz_status_message: string | null
  } | null
  items?: InboundNfeItemRow[]
}

function isInboundNfeEditable (document: InboundNfeDocumentRow) {
  return document.status === 'draft' &&
    (!document.fiscal_document || document.fiscal_document.status === 'rejected')
}

export type ManualProductLineInput = {
  description: string
  quantity: number
  unitValueCents: number
  productId?: string | null
  productCode?: string | null
  barcode?: string | null
  ncm?: string | null
  cest?: string | null
  unit?: string | null
  cfop?: string | null
  fiscalOrigin?: number | null
  icmsCsosn?: string | null
  pisCst?: string | null
  cofinsCst?: string | null
  ipiCst?: string | null
}

export type UsedDeviceLineInput = {
  device: UsedDeviceSnapshot
  purchaseValueCents: number
}

const DOC_SELECT = [
  'id',
  'entry_kind',
  'source_mode',
  'entry_type',
  'access_key',
  'series',
  'number',
  'issued_at',
  'issuer_cnpj',
  'issuer_name',
  'recipient_cnpj',
  'recipient_name',
  'seller_customer_id',
  'seller_name',
  'seller_document',
  'fiscal_purpose',
  'should_move_stock',
  'operation_nature',
  'freight_cents',
  'insurance_cents',
  'other_expenses_cents',
  'discount_cents',
  'transport_mode',
  'complementary_information',
  'fiscal_information',
  'fiscal_payments',
  'purchase_payment_methods',
  'total_cents',
  'status',
  'notes',
  'posted_at',
  'created_at',
  'updated_at',
].join(', ')

const ITEM_SELECT = [
  'id',
  'line_number',
  'item_kind',
  'product_code',
  'barcode',
  'description',
  'ncm',
  'cest',
  'unit',
  'cfop',
  'fiscal_origin',
  'icms_csosn',
  'icms_cst',
  'pis_cst',
  'cofins_cst',
  'ipi_cst',
  'quantity',
  'unit_value_cents',
  'total_cents',
  'product_id',
  'stock_movement_id',
  'resale_device_id',
  'device_snapshot',
].join(', ')

function cleanText (value: unknown) {
  return String(value ?? '').trim()
}

function normalizeFiscalPayments (value: unknown): InboundFiscalPayment[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const row = raw as Record<string, unknown>
    const type = onlyDigits(String(row.type || row.payment_type || '')).slice(0, 2)
    const valueCents = Math.max(0, Math.round(Number(row.value_cents) || 0))
    if (type.length !== 2 || (type !== '90' && valueCents <= 0)) return []
    return [{ type, value_cents: type === '90' ? 0 : valueCents }]
  })
}

function allocateDevicePaymentCents (
  payments: Array<{ value_cents: number }>,
  purchaseValueCents: number,
) {
  return syncAmountRowsToTotal(
    payments.map((payment) => ({ type: '', valueCents: payment.value_cents })),
    purchaseValueCents,
  )
}

function fiscalPaymentsForTotal (
  payments: InboundFiscalPayment[],
  totalCents: number,
): InboundFiscalPayment[] {
  const payableSum = payments.reduce(
    (sum, payment) => sum + (payment.type === '90' ? 0 : payment.value_cents),
    0,
  )
  if (payableSum === totalCents) return payments
  const synced = syncAmountRowsToTotal(
    payments.map((payment) => ({ type: payment.type, valueCents: payment.value_cents })),
    totalCents,
  )
  return normalizeFiscalPayments(payments.map((payment, index) => ({
    type: payment.type,
    value_cents: synced[index] ?? 0,
  })))
}

function asRowWithId (row: unknown): { id: string } | null {
  if (!row || typeof row !== 'object') return null
  const id = String((row as { id?: unknown }).id || '').trim()
  if (!id) return null
  return { id }
}

function stockQuantityFromXml (quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  const rounded = Math.round(quantity)
  if (Math.abs(quantity - rounded) > 0.0001) return null
  return rounded
}

function parsePurchasePayments (raw: unknown, purchaseValueCents: number) {
  const fromJson = coerceRawSalePaymentsToArray(raw)
    .map(mapLooseEntryToSalePaymentRow)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      payment_method_id: String(item.payment_method_id || '').trim(),
      value_cents: item.value_cents != null ? Math.max(0, Number(item.value_cents) || 0) : null,
      installments: item.installments ?? null,
    }))
    .filter((item) => item.payment_method_id)

  if (fromJson.length === 0) return [] as Array<{
    payment_method_id: string
    value_cents: number
    installments: number | null
  }>

  return fromJson
    .map((item) => ({
      payment_method_id: item.payment_method_id,
      value_cents: item.value_cents && item.value_cents > 0
        ? item.value_cents
        : (fromJson.length === 1 ? purchaseValueCents : 0),
      installments: item.installments,
    }))
    .filter((item) => item.value_cents > 0)
}

async function nextInboundNumber (auth: AuthCtx) {
  const { data } = await auth.supabase
    .from('inbound_nfe_documents')
    .select('number')
    .eq('organization_id', auth.organizationId)
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const current = Number(data?.number || 0)
  return Number.isFinite(current) && current > 0 ? current + 1 : 1
}

export async function getNextInboundReferenceNumber (auth: AuthCtx) {
  return nextInboundNumber(auth)
}

async function suggestProductMatches (
  auth: AuthCtx,
  items: Array<{ barcode: string | null, productCode: string | null, description: string }>,
) {
  const barcodes = [...new Set(items.map((item) => onlyDigits(item.barcode || '')).filter((v) => v.length >= 8))]
  const codes = [...new Set(items.map((item) => String(item.productCode || '').trim()).filter(Boolean))]

  const byBarcode = new Map<string, { id: string, name: string, sku: string | null, barcode: string | null }>()
  const bySku = new Map<string, { id: string, name: string, sku: string | null, barcode: string | null }>()

  if (barcodes.length > 0) {
    const { data } = await auth.supabase
      .from('products')
      .select('id, name, sku, barcode')
      .eq('organization_id', auth.organizationId)
      .eq('kind', 'product')
      .eq('is_active', true)
      .in('barcode', barcodes)
    for (const row of data || []) {
      const barcode = onlyDigits(String(row.barcode || ''))
      if (barcode) {
        byBarcode.set(barcode, {
          id: String(row.id),
          name: String(row.name || ''),
          sku: row.sku ? String(row.sku) : null,
          barcode: row.barcode ? String(row.barcode) : null,
        })
      }
    }
  }

  if (codes.length > 0) {
    const { data } = await auth.supabase
      .from('products')
      .select('id, name, sku, barcode')
      .eq('organization_id', auth.organizationId)
      .eq('kind', 'product')
      .eq('is_active', true)
      .in('sku', codes)
    for (const row of data || []) {
      const sku = String(row.sku || '').trim()
      if (sku) {
        bySku.set(sku.toLowerCase(), {
          id: String(row.id),
          name: String(row.name || ''),
          sku: row.sku ? String(row.sku) : null,
          barcode: row.barcode ? String(row.barcode) : null,
        })
      }
    }
  }

  return items.map((item) => {
    const barcode = onlyDigits(item.barcode || '')
    const code = String(item.productCode || '').trim().toLowerCase()
    return byBarcode.get(barcode) || bySku.get(code) || null
  })
}

function mapItemRow (row: Record<string, unknown>): InboundNfeItemRow {
  const productRaw = row.products
  const product = (Array.isArray(productRaw) ? productRaw[0] : productRaw) as {
    id?: string
    name?: string
    sku?: string | null
    barcode?: string | null
  } | null
  const snapshotRaw = row.device_snapshot
  const deviceSnapshot = snapshotRaw && typeof snapshotRaw === 'object'
    ? snapshotRaw as UsedDeviceSnapshot
    : null

  return {
    id: String(row.id),
    line_number: Number(row.line_number),
    item_kind: row.item_kind === 'used_device' ? 'used_device' : 'product',
    product_code: row.product_code ? String(row.product_code) : null,
    barcode: row.barcode ? String(row.barcode) : null,
    description: String(row.description || ''),
    ncm: row.ncm ? String(row.ncm) : null,
    cest: row.cest ? String(row.cest) : null,
    unit: row.unit ? String(row.unit) : null,
    cfop: row.cfop ? String(row.cfop) : null,
    fiscal_origin: row.fiscal_origin == null ? null : Number(row.fiscal_origin),
    icms_csosn: row.icms_csosn ? String(row.icms_csosn) : null,
    icms_cst: row.icms_cst ? String(row.icms_cst) : null,
    pis_cst: row.pis_cst ? String(row.pis_cst) : null,
    cofins_cst: row.cofins_cst ? String(row.cofins_cst) : null,
    ipi_cst: row.ipi_cst ? String(row.ipi_cst) : null,
    quantity: Number(row.quantity),
    unit_value_cents: Number(row.unit_value_cents || 0),
    total_cents: Number(row.total_cents || 0),
    product_id: row.product_id ? String(row.product_id) : null,
    stock_movement_id: row.stock_movement_id ? String(row.stock_movement_id) : null,
    resale_device_id: row.resale_device_id ? String(row.resale_device_id) : null,
    device_snapshot: deviceSnapshot,
    product: product?.id
      ? {
        id: String(product.id),
        name: String(product.name || ''),
        sku: product.sku ? String(product.sku) : null,
        barcode: product.barcode ? String(product.barcode) : null,
      }
      : null,
  }
}

export async function listInboundNfeDocuments (auth: AuthCtx) {
  const { data, error } = await auth.supabase
    .from('inbound_nfe_documents')
    .select(DOC_SELECT)
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[inbound-nfe] list', error)
    return { ok: false as const, error: 'db_error' as const }
  }

  const documents = (data || []) as unknown as InboundNfeDocumentRow[]
  const ids = documents.map((document) => document.id)
  const { data: fiscalDocuments, error: fiscalError } = ids.length > 0
    ? await auth.supabase
      .from('fiscal_documents')
      .select('id, inbound_nfe_id, status, series, number, access_key, sefaz_status_message, created_at')
      .eq('organization_id', auth.organizationId)
      .in('inbound_nfe_id', ids)
      .order('created_at', { ascending: false })
    : { data: [], error: null }

  if (fiscalError) {
    console.error('[inbound-nfe] list fiscal documents', fiscalError)
    return { ok: false as const, error: 'db_error' as const }
  }

  const fiscalByInboundId = new Map<string, InboundNfeDocumentRow['fiscal_document']>()
  for (const fiscalDocument of fiscalDocuments || []) {
    const inboundNfeId = String(fiscalDocument.inbound_nfe_id || '')
    if (!inboundNfeId || fiscalByInboundId.has(inboundNfeId)) continue
    fiscalByInboundId.set(inboundNfeId, {
      id: String(fiscalDocument.id),
      status: String(fiscalDocument.status || ''),
      series: Number(fiscalDocument.series || 0),
      number: Number(fiscalDocument.number || 0),
      access_key: fiscalDocument.access_key ? String(fiscalDocument.access_key) : null,
      sefaz_status_message: fiscalDocument.sefaz_status_message
        ? String(fiscalDocument.sefaz_status_message)
        : null,
    })
  }

  return {
    ok: true as const,
    documents: documents.map((document) => ({
      ...document,
      fiscal_document: fiscalByInboundId.get(document.id) || null,
    })),
  }
}

export async function getInboundNfeDocument (auth: AuthCtx, documentId: string) {
  const { data: doc, error } = await auth.supabase
    .from('inbound_nfe_documents')
    .select(DOC_SELECT)
    .eq('organization_id', auth.organizationId)
    .eq('id', documentId)
    .maybeSingle()

  if (error) {
    console.error('[inbound-nfe] get', error)
    return { ok: false as const, error: 'db_error' as const }
  }
  if (!doc) return { ok: false as const, error: 'not_found' as const }

  const { data: items, error: itemsError } = await auth.supabase
    .from('inbound_nfe_items')
    .select(`${ITEM_SELECT}, products ( id, name, sku, barcode )`)
    .eq('organization_id', auth.organizationId)
    .eq('inbound_nfe_id', documentId)
    .order('line_number', { ascending: true })

  if (itemsError) {
    console.error('[inbound-nfe] get items', itemsError)
    return { ok: false as const, error: 'db_error' as const }
  }

  const { data: fiscalDocument, error: fiscalError } = await auth.supabase
    .from('fiscal_documents')
    .select('id, status, series, number, access_key, sefaz_status_message')
    .eq('organization_id', auth.organizationId)
    .eq('inbound_nfe_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fiscalError) {
    console.error('[inbound-nfe] get fiscal document', fiscalError)
    return { ok: false as const, error: 'db_error' as const }
  }

  return {
    ok: true as const,
    document: {
      ...(doc as unknown as InboundNfeDocumentRow),
      fiscal_document: fiscalDocument
        ? {
          id: String(fiscalDocument.id),
          status: String(fiscalDocument.status || ''),
          series: Number(fiscalDocument.series || 0),
          number: Number(fiscalDocument.number || 0),
          access_key: fiscalDocument.access_key ? String(fiscalDocument.access_key) : null,
          sefaz_status_message: fiscalDocument.sefaz_status_message
            ? String(fiscalDocument.sefaz_status_message)
            : null,
        }
        : null,
      items: (items || []).map((row) => mapItemRow(row as unknown as Record<string, unknown>)),
    },
  }
}

export async function importInboundNfeXml (auth: AuthCtx, xmlContent: string) {
  const parsed = parseInboundNfeXml(xmlContent)
  if (parsed.ok === false) {
    return { ok: false as const, error: parsed.error, message: parsed.message }
  }

  const doc = parsed.document
  const matches = await suggestProductMatches(auth, doc.items)

  const { data: insertedRaw, error } = await auth.supabase
    .from('inbound_nfe_documents')
    .insert({
      organization_id: auth.organizationId,
      entry_kind: 'products',
      source_mode: 'xml',
      entry_type: 'xml_import',
      access_key: doc.accessKey,
      series: doc.series,
      number: doc.number,
      issued_at: doc.issuedAt,
      issuer_cnpj: doc.issuerCnpj,
      issuer_name: doc.issuerName,
      recipient_cnpj: doc.recipientCnpj,
      recipient_name: doc.recipientName,
      total_cents: doc.totalCents,
      status: 'draft',
      xml_content: xmlContent,
      created_by: auth.userId,
    })
    .select('id')
    .single()

  const inserted = asRowWithId(insertedRaw)
  if (error || !inserted) {
    if (String(error?.code || '') === '23505') {
      return {
        ok: false as const,
        error: 'duplicate_access_key' as const,
        message: 'Esta NF-e já foi importada (chave de acesso repetida).',
      }
    }
    console.error('[inbound-nfe] insert document', error)
    const detail = String(error?.message || '').trim()
    return {
      ok: false as const,
      error: 'db_error' as const,
      message: detail
        ? `Não foi possível salvar a NF-e importada. ${detail}`
        : 'Não foi possível salvar a NF-e importada.',
    }
  }

  const itemRows = doc.items.map((item, index) => ({
    organization_id: auth.organizationId,
    inbound_nfe_id: inserted.id,
    line_number: item.lineNumber,
    item_kind: 'product',
    product_code: item.productCode,
    barcode: item.barcode,
    description: item.description,
    ncm: item.ncm,
    cest: item.cest,
    unit: item.unit,
    quantity: item.quantity,
    unit_value_cents: item.unitValueCents,
    total_cents: item.totalCents,
    product_id: matches[index]?.id ?? null,
  }))

  const { error: itemsError } = await auth.supabase
    .from('inbound_nfe_items')
    .insert(itemRows)

  if (itemsError) {
    console.error('[inbound-nfe] insert items', itemsError)
    const detail = String(itemsError.message || '').trim()
    await auth.supabase
      .from('inbound_nfe_documents')
      .delete()
      .eq('id', inserted.id)
      .eq('organization_id', auth.organizationId)
    return {
      ok: false as const,
      error: 'db_error' as const,
      message: detail
        ? `Não foi possível salvar os itens da NF-e. ${detail}`
        : 'Não foi possível salvar os itens da NF-e.',
    }
  }

  return getInboundNfeDocument(auth, inserted.id)
}

export async function createManualProductsInbound (
  auth: AuthCtx,
  input: {
    sellerCustomerId?: string | null
    entryType?: Exclude<InboundEntryType, 'xml_import'>
    importDeclaration?: Record<string, unknown> | null
    freightCents?: number
    insuranceCents?: number
    otherExpensesCents?: number
    discountCents?: number
    transportMode?: 'none' | 'buyer' | 'seller' | 'carrier'
    complementaryInformation?: string | null
    fiscalInformation?: string | null
    fiscalPayments?: unknown
    sellerName?: string | null
    sellerDocument?: string | null
    fiscalPurpose?: InboundFiscalPurpose
    shouldMoveStock?: boolean
    operationNature?: string | null
    issuerName?: string | null
    issuedAt?: string | null
    notes?: string | null
    items: ManualProductLineInput[]
  },
) {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false as const, error: 'empty_items' as const, message: 'Adicione ao menos um item.' }
  }

  const lines: ManualProductLineInput[] = []
  for (const raw of input.items) {
    const description = cleanText(raw.description)
    const quantity = Number(raw.quantity)
    const unitValueCents = Math.max(0, Math.round(Number(raw.unitValueCents) || 0))
    if (!description) {
      return { ok: false as const, error: 'invalid_item' as const, message: 'Informe a descrição de todos os itens.' }
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false as const, error: 'invalid_quantity' as const, message: `Quantidade inválida em "${description}".` }
    }
    const ncm = onlyDigits(raw.ncm || '')
    const cfop = onlyDigits(raw.cfop || '')
    const fiscalOrigin = Number(raw.fiscalOrigin)
    const icmsCsosn = onlyDigits(raw.icmsCsosn || '')
    const pisCst = onlyDigits(raw.pisCst || '')
    const cofinsCst = onlyDigits(raw.cofinsCst || '')
    if (ncm.length !== 8) {
      return { ok: false as const, error: 'invalid_ncm' as const, message: `Informe o NCM com 8 dígitos em "${description}".` }
    }
    if (!/^[12]\d{3}$/.test(cfop)) {
      return { ok: false as const, error: 'invalid_cfop' as const, message: `Informe um CFOP de entrada válido em "${description}".` }
    }
    if (!Number.isInteger(fiscalOrigin) || fiscalOrigin < 0 || fiscalOrigin > 8) {
      return { ok: false as const, error: 'invalid_origin' as const, message: `Informe a origem fiscal em "${description}".` }
    }
    if (icmsCsosn.length !== 3 || pisCst.length !== 2 || cofinsCst.length !== 2) {
      return { ok: false as const, error: 'invalid_tax_code' as const, message: `Revise CSOSN, CST PIS e CST COFINS em "${description}".` }
    }
    lines.push({
      description,
      quantity,
      unitValueCents,
      productId: raw.productId || null,
      productCode: cleanText(raw.productCode) || null,
      barcode: onlyDigits(raw.barcode || '') || null,
      ncm,
      cest: onlyDigits(raw.cest || '') || null,
      unit: cleanText(raw.unit || 'UN').toUpperCase().slice(0, 6) || 'UN',
      cfop,
      fiscalOrigin,
      icmsCsosn,
      pisCst,
      cofinsCst,
      ipiCst: onlyDigits(raw.ipiCst || '') || null,
    })
  }

  const productsTotalCents = lines.reduce(
    (sum, line) => sum + Math.round(line.unitValueCents * line.quantity),
    0,
  )
  const freightCents = Math.max(0, Math.round(Number(input.freightCents) || 0))
  const insuranceCents = Math.max(0, Math.round(Number(input.insuranceCents) || 0))
  const otherExpensesCents = Math.max(0, Math.round(Number(input.otherExpensesCents) || 0))
  const discountCents = Math.max(0, Math.round(Number(input.discountCents) || 0))
  const totalCents = Math.max(
    0,
    productsTotalCents + freightCents + insuranceCents + otherExpensesCents - discountCents,
  )
  const number = await nextInboundNumber(auth)
  const issuedAt = input.issuedAt ? new Date(input.issuedAt).toISOString() : new Date().toISOString()
  const fiscalPurpose = input.fiscalPurpose === 'fixed_asset' || input.fiscalPurpose === 'use_consumption'
    ? input.fiscalPurpose
    : 'resale'

  const { data: insertedRaw, error } = await auth.supabase
    .from('inbound_nfe_documents')
    .insert({
      organization_id: auth.organizationId,
      entry_kind: 'products',
      source_mode: 'manual',
      entry_type: input.entryType || 'own_issuance',
      import_declaration: input.entryType === 'import' ? input.importDeclaration || {} : null,
      access_key: null,
      series: 1,
      number,
      issued_at: Number.isNaN(new Date(issuedAt).getTime()) ? new Date().toISOString() : issuedAt,
      issuer_name: cleanText(input.issuerName) || null,
      seller_customer_id: cleanText(input.sellerCustomerId) || null,
      seller_name: cleanText(input.sellerName) || null,
      seller_document: onlyDigits(input.sellerDocument || '') || null,
      fiscal_purpose: fiscalPurpose,
      should_move_stock: input.shouldMoveStock === true,
      operation_nature: cleanText(input.operationNature) || (
        fiscalPurpose === 'fixed_asset'
          ? 'Compra de bem para o ativo imobilizado'
          : fiscalPurpose === 'use_consumption'
            ? 'Compra de material para uso ou consumo'
            : 'Compra de mercadoria para comercialização'
      ),
      freight_cents: freightCents,
      insurance_cents: insuranceCents,
      other_expenses_cents: otherExpensesCents,
      discount_cents: discountCents,
      transport_mode: input.transportMode || 'none',
      complementary_information: cleanText(input.complementaryInformation) || null,
      fiscal_information: cleanText(input.fiscalInformation) || null,
      fiscal_payments: normalizeFiscalPayments(input.fiscalPayments),
      total_cents: totalCents,
      status: 'draft',
      xml_content: null,
      notes: cleanText(input.notes) || null,
      created_by: auth.userId,
    })
    .select('id')
    .single()

  const inserted = asRowWithId(insertedRaw)
  if (error || !inserted) {
    console.error('[inbound-nfe] manual insert', error)
    return { ok: false as const, error: 'db_error' as const, message: 'Não foi possível criar a NF-e de entrada.' }
  }

  const itemRows = lines.map((line, index) => ({
    organization_id: auth.organizationId,
    inbound_nfe_id: inserted.id,
    line_number: index + 1,
    item_kind: 'product',
    product_code: line.productCode,
    barcode: line.barcode,
    description: line.description,
    ncm: line.ncm,
    cest: line.cest,
    unit: line.unit,
    cfop: line.cfop,
    fiscal_origin: line.fiscalOrigin,
    icms_csosn: line.icmsCsosn,
    pis_cst: line.pisCst,
    cofins_cst: line.cofinsCst,
    ipi_cst: line.ipiCst,
    quantity: line.quantity,
    unit_value_cents: line.unitValueCents,
    total_cents: Math.round(line.unitValueCents * line.quantity),
    product_id: line.productId || null,
  }))

  const { error: itemsError } = await auth.supabase
    .from('inbound_nfe_items')
    .insert(itemRows)

  if (itemsError) {
    console.error('[inbound-nfe] manual items', itemsError)
    await auth.supabase.from('inbound_nfe_documents').delete().eq('id', inserted.id)
    return { ok: false as const, error: 'db_error' as const, message: 'Não foi possível salvar os itens.' }
  }

  return getInboundNfeDocument(auth, inserted.id)
}

export async function createUsedDevicesInbound (
  auth: AuthCtx,
  input: {
    sellerCustomerId?: string | null
    sellerName?: string | null
    sellerDocument?: string | null
    purchaseDate?: string | null
    purchasePaymentMethods?: unknown
    notes?: string | null
    devices: UsedDeviceLineInput[]
  },
) {
  if (!auth.isAdmin) {
    return {
      ok: false as const,
      error: 'purchase_value_forbidden' as const,
      message: 'Apenas administradores podem registrar entrada de usados com valor.',
    }
  }

  if (!Array.isArray(input.devices) || input.devices.length === 0) {
    return { ok: false as const, error: 'empty_items' as const, message: 'Adicione ao menos um aparelho.' }
  }

  const lines: UsedDeviceLineInput[] = []
  for (const raw of input.devices) {
    const deviceName = cleanText(raw.device?.device_name)
    const purchaseValueCents = Math.max(0, Math.round(Number(raw.purchaseValueCents) || 0))
    if (!deviceName) {
      return { ok: false as const, error: 'device_name_required' as const, message: 'Informe o nome de cada aparelho.' }
    }
    if (purchaseValueCents <= 0) {
      return {
        ok: false as const,
        error: 'purchase_value_required' as const,
        message: `Informe o valor pago em "${deviceName}".`,
      }
    }
    lines.push({
      purchaseValueCents,
      device: {
        device_name: deviceName,
        color: cleanText(raw.device.color) || null,
        storage_gb: cleanText(raw.device.storage_gb) || null,
        battery: cleanText(raw.device.battery) || null,
        condition: cleanText(raw.device.condition) || null,
        info: cleanText(raw.device.info) || null,
        imei: cleanText(raw.device.imei) || null,
        imei2: cleanText(raw.device.imei2) || null,
        serial: cleanText(raw.device.serial) || null,
        sale_value_cents: raw.device.sale_value_cents != null
          ? Math.max(0, Math.round(Number(raw.device.sale_value_cents) || 0))
          : null,
      },
    })
  }

  const totalCents = lines.reduce((sum, line) => sum + line.purchaseValueCents, 0)
  const payments = parsePurchasePayments(input.purchasePaymentMethods, totalCents)
  const number = await nextInboundNumber(auth)
  const purchaseDate = cleanText(input.purchaseDate) || new Date().toISOString().slice(0, 10)
  const issuedAt = new Date(`${purchaseDate}T12:00:00`).toISOString()

  const { data: insertedRaw, error } = await auth.supabase
    .from('inbound_nfe_documents')
    .insert({
      organization_id: auth.organizationId,
      entry_kind: 'used_devices',
      source_mode: 'manual',
      entry_type: 'own_issuance',
      access_key: null,
      series: 1,
      number,
      issued_at: Number.isNaN(new Date(issuedAt).getTime()) ? new Date().toISOString() : issuedAt,
      issuer_name: cleanText(input.sellerName) || 'Cliente (usados)',
      seller_customer_id: cleanText(input.sellerCustomerId) || null,
      seller_name: cleanText(input.sellerName) || null,
      seller_document: onlyDigits(input.sellerDocument || '') || null,
      purchase_payment_methods: payments.length > 0 ? payments : null,
      total_cents: totalCents,
      status: 'draft',
      xml_content: null,
      notes: cleanText(input.notes) || null,
      created_by: auth.userId,
    })
    .select('id')
    .single()

  const inserted = asRowWithId(insertedRaw)
  if (error || !inserted) {
    console.error('[inbound-nfe] used insert', error)
    return { ok: false as const, error: 'db_error' as const, message: 'Não foi possível criar a entrada de usados.' }
  }

  const itemRows = lines.map((line, index) => ({
    organization_id: auth.organizationId,
    inbound_nfe_id: inserted.id,
    line_number: index + 1,
    item_kind: 'used_device',
    description: line.device.device_name,
    quantity: 1,
    unit: 'UN',
    unit_value_cents: line.purchaseValueCents,
    total_cents: line.purchaseValueCents,
    device_snapshot: line.device,
  }))

  const { error: itemsError } = await auth.supabase
    .from('inbound_nfe_items')
    .insert(itemRows)

  if (itemsError) {
    console.error('[inbound-nfe] used items', itemsError)
    await auth.supabase.from('inbound_nfe_documents').delete().eq('id', inserted.id)
    return { ok: false as const, error: 'db_error' as const, message: 'Não foi possível salvar os aparelhos.' }
  }

  return getInboundNfeDocument(auth, inserted.id)
}

export async function updateInboundNfeFiscalSettings (
  auth: AuthCtx,
  documentId: string,
  input: {
    fiscalPurpose: InboundFiscalPurpose
    shouldMoveStock: boolean
    operationNature?: string | null
    freightCents?: number
    insuranceCents?: number
    otherExpensesCents?: number
    discountCents?: number
    transportMode?: 'none' | 'buyer' | 'seller' | 'carrier'
    complementaryInformation?: string | null
    fiscalInformation?: string | null
    fiscalPayments?: unknown
  },
) {
  const loaded = await getInboundNfeDocument(auth, documentId)
  if (!loaded.ok) return loaded
  if (!isInboundNfeEditable(loaded.document)) {
    return {
      ok: false as const,
      error: 'not_editable' as const,
      message: 'Somente rascunhos podem ter os dados fiscais alterados.',
    }
  }

  const freightCents = input.freightCents == null
    ? loaded.document.freight_cents
    : Math.max(0, Math.round(Number(input.freightCents) || 0))
  const insuranceCents = input.insuranceCents == null
    ? loaded.document.insurance_cents
    : Math.max(0, Math.round(Number(input.insuranceCents) || 0))
  const otherExpensesCents = input.otherExpensesCents == null
    ? loaded.document.other_expenses_cents
    : Math.max(0, Math.round(Number(input.otherExpensesCents) || 0))
  const discountCents = input.discountCents == null
    ? loaded.document.discount_cents
    : Math.max(0, Math.round(Number(input.discountCents) || 0))
  const productsTotalCents = (loaded.document.items || [])
    .reduce((total, item) => total + item.total_cents, 0)
  const totalCents = Math.max(
    0,
    productsTotalCents + freightCents + insuranceCents + otherExpensesCents - discountCents,
  )

  const { error } = await auth.supabase
    .from('inbound_nfe_documents')
    .update({
      fiscal_purpose: input.fiscalPurpose,
      should_move_stock: input.shouldMoveStock,
      operation_nature: cleanText(input.operationNature) || loaded.document.operation_nature,
      freight_cents: freightCents,
      insurance_cents: insuranceCents,
      other_expenses_cents: otherExpensesCents,
      discount_cents: discountCents,
      total_cents: totalCents,
      fiscal_payments: input.fiscalPayments === undefined
        ? fiscalPaymentsForTotal(loaded.document.fiscal_payments, totalCents)
        : normalizeFiscalPayments(input.fiscalPayments),
      transport_mode: input.transportMode || loaded.document.transport_mode,
      complementary_information: input.complementaryInformation === undefined
        ? loaded.document.complementary_information
        : cleanText(input.complementaryInformation) || null,
      fiscal_information: input.fiscalInformation === undefined
        ? loaded.document.fiscal_information
        : cleanText(input.fiscalInformation) || null,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('id', documentId)

  if (error) {
    console.error('[inbound-nfe] update fiscal settings', error)
    return {
      ok: false as const,
      error: 'db_error' as const,
      message: 'Não foi possível atualizar os dados fiscais da entrada.',
    }
  }

  return getInboundNfeDocument(auth, documentId)
}

export async function updateInboundNfeSeller (
  auth: AuthCtx,
  documentId: string,
  customerId: string,
) {
  const loaded = await getInboundNfeDocument(auth, documentId)
  if (!loaded.ok) return loaded
  if (!isInboundNfeEditable(loaded.document)) {
    return {
      ok: false as const,
      error: 'not_editable' as const,
      message: 'Somente rascunhos podem ter o cliente alterado.',
    }
  }

  const { data: customer, error: customerError } = await auth.supabase
    .from('customers')
    .select('id, cpf, cnpj, full_name, is_company, company_name, trade_name')
    .eq('organization_id', auth.organizationId)
    .eq('id', customerId)
    .maybeSingle()

  if (customerError || !customer?.id) {
    return {
      ok: false as const,
      error: 'customer_not_found' as const,
      message: 'Cliente não encontrado.',
    }
  }

  const sellerName = customer.is_company
    ? cleanText(customer.company_name || customer.trade_name || customer.full_name)
    : cleanText(customer.full_name)
  const sellerDocument = onlyDigits(customer.cnpj || customer.cpf || '')
  if (!sellerName || (sellerDocument.length !== 11 && sellerDocument.length !== 14)) {
    return {
      ok: false as const,
      error: 'customer_incomplete' as const,
      message: 'O cliente precisa ter nome e CPF ou CNPJ válidos.',
    }
  }

  const { error } = await auth.supabase
    .from('inbound_nfe_documents')
    .update({
      seller_customer_id: String(customer.id),
      seller_name: sellerName,
      seller_document: sellerDocument,
      issuer_name: sellerName,
      issuer_cnpj: sellerDocument,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('id', documentId)

  if (error) {
    console.error('[inbound-nfe] update seller', error)
    return {
      ok: false as const,
      error: 'db_error' as const,
      message: 'Não foi possível alterar o cliente da NF-e.',
    }
  }

  return getInboundNfeDocument(auth, documentId)
}

export async function linkInboundNfeItem (
  auth: AuthCtx,
  documentId: string,
  itemId: string,
  productId: string | null,
) {
  const loaded = await getInboundNfeDocument(auth, documentId)
  if (!loaded.ok) return loaded
  if (!isInboundNfeEditable(loaded.document)) {
    return {
      ok: false as const,
      error: 'not_editable' as const,
      message: 'Somente rascunhos podem ter itens vinculados.',
    }
  }
  if (loaded.document.entry_kind !== 'products') {
    return {
      ok: false as const,
      error: 'not_editable' as const,
      message: 'Vínculo de produto só se aplica a entradas de mercadoria.',
    }
  }

  if (productId) {
    const { data: product } = await auth.supabase
      .from('products')
      .select('id, kind')
      .eq('organization_id', auth.organizationId)
      .eq('id', productId)
      .maybeSingle()
    if (!product || String(product.kind || '') === 'service') {
      return {
        ok: false as const,
        error: 'invalid_product' as const,
        message: 'Selecione um produto válido (não serviço).',
      }
    }
  }

  const { error } = await auth.supabase
    .from('inbound_nfe_items')
    .update({
      product_id: productId,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('inbound_nfe_id', documentId)
    .eq('id', itemId)

  if (error) {
    console.error('[inbound-nfe] link item', error)
    return { ok: false as const, error: 'db_error' as const, message: 'Não foi possível vincular o produto.' }
  }

  return getInboundNfeDocument(auth, documentId)
}

export async function updateInboundNfeItemFiscal (
  auth: AuthCtx,
  documentId: string,
  itemId: string,
  input: {
    ncm: string
    cest?: string | null
    unit: string
    cfop: string
    fiscalOrigin: number
    icmsCsosn: string
    pisCst: string
    cofinsCst: string
    ipiCst?: string | null
    quantity?: number
    unitValueCents?: number
    description?: string
    productCode?: string | null
    barcode?: string | null
  },
) {
  const loaded = await getInboundNfeDocument(auth, documentId)
  if (!loaded.ok) return loaded
  if (!isInboundNfeEditable(loaded.document) || loaded.document.entry_kind !== 'products') {
    return {
      ok: false as const,
      error: 'not_editable' as const,
      message: 'Somente itens de rascunhos de mercadoria podem ser alterados.',
    }
  }

  const ncm = onlyDigits(input.ncm)
  const cfop = onlyDigits(input.cfop)
  const fiscalOrigin = Number(input.fiscalOrigin)
  const icmsCsosn = onlyDigits(input.icmsCsosn)
  const pisCst = onlyDigits(input.pisCst)
  const cofinsCst = onlyDigits(input.cofinsCst)
  if (ncm.length !== 8 || !/^[12]\d{3}$/.test(cfop)) {
    return { ok: false as const, error: 'invalid_fiscal_data' as const, message: 'Revise o NCM e o CFOP do item.' }
  }
  if (!Number.isInteger(fiscalOrigin) || fiscalOrigin < 0 || fiscalOrigin > 8) {
    return { ok: false as const, error: 'invalid_origin' as const, message: 'Informe uma origem fiscal válida.' }
  }
  if (icmsCsosn.length !== 3 || pisCst.length !== 2 || cofinsCst.length !== 2) {
    return { ok: false as const, error: 'invalid_tax_code' as const, message: 'Revise CSOSN, CST PIS e CST COFINS.' }
  }
  const currentItem = (loaded.document.items || []).find((item) => item.id === itemId)
  if (!currentItem) {
    return { ok: false as const, error: 'not_found' as const, message: 'Item não encontrado.' }
  }
  const quantity = input.quantity == null ? currentItem.quantity : Number(input.quantity)
  const unitValueCents = input.unitValueCents == null
    ? currentItem.unit_value_cents
    : Math.max(0, Math.round(Number(input.unitValueCents) || 0))
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false as const, error: 'invalid_quantity' as const, message: 'Informe uma quantidade válida.' }
  }
  const itemTotalCents = Math.round(quantity * unitValueCents)
  const description = input.description == null
    ? currentItem.description
    : cleanText(input.description)
  if (!description) {
    return { ok: false as const, error: 'invalid_description' as const, message: 'Informe a descrição do produto.' }
  }

  const { error } = await auth.supabase
    .from('inbound_nfe_items')
    .update({
      ncm,
      cest: onlyDigits(input.cest || '') || null,
      unit: cleanText(input.unit || 'UN').toUpperCase().slice(0, 6) || 'UN',
      cfop,
      fiscal_origin: fiscalOrigin,
      icms_csosn: icmsCsosn,
      icms_cst: null,
      pis_cst: pisCst,
      cofins_cst: cofinsCst,
      ipi_cst: onlyDigits(input.ipiCst || '') || null,
      quantity,
      unit_value_cents: unitValueCents,
      total_cents: itemTotalCents,
      description,
      product_code: input.productCode === undefined
        ? currentItem.product_code
        : cleanText(input.productCode) || null,
      barcode: input.barcode === undefined
        ? currentItem.barcode
        : onlyDigits(input.barcode || '') || null,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('inbound_nfe_id', documentId)
    .eq('id', itemId)

  if (error) {
    console.error('[inbound-nfe] update item fiscal', error)
    return { ok: false as const, error: 'db_error' as const, message: 'Não foi possível salvar os dados fiscais do item.' }
  }

  const productsTotalCents = (loaded.document.items || []).reduce(
    (total, item) => total + (item.id === itemId ? itemTotalCents : item.total_cents),
    0,
  )
  const totalCents = Math.max(
    0,
    productsTotalCents
      + loaded.document.freight_cents
      + loaded.document.insurance_cents
      + loaded.document.other_expenses_cents
      - loaded.document.discount_cents,
  )
  await auth.supabase
    .from('inbound_nfe_documents')
    .update({
      total_cents: totalCents,
      fiscal_payments: fiscalPaymentsForTotal(loaded.document.fiscal_payments, totalCents),
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('id', documentId)

  return getInboundNfeDocument(auth, documentId)
}

export async function deleteInboundNfeItem (
  auth: AuthCtx,
  documentId: string,
  itemId: string,
) {
  const loaded = await getInboundNfeDocument(auth, documentId)
  if (!loaded.ok) return loaded
  if (!isInboundNfeEditable(loaded.document)) {
    return {
      ok: false as const,
      error: 'not_editable' as const,
      message: 'Somente itens de rascunhos podem ser excluídos.',
    }
  }

  const items = loaded.document.items || []
  if (!items.some((item) => item.id === itemId)) {
    return { ok: false as const, error: 'not_found' as const, message: 'Item não encontrado.' }
  }
  if (items.length <= 1) {
    return {
      ok: false as const,
      error: 'last_item' as const,
      message: 'A NF-e precisa manter ao menos um item.',
    }
  }

  const { error } = await auth.supabase
    .from('inbound_nfe_items')
    .delete()
    .eq('organization_id', auth.organizationId)
    .eq('inbound_nfe_id', documentId)
    .eq('id', itemId)

  if (error) {
    console.error('[inbound-nfe] delete item', error)
    return { ok: false as const, error: 'db_error' as const, message: 'Não foi possível excluir o item.' }
  }

  const productsTotalCents = items
    .filter((item) => item.id !== itemId)
    .reduce((total, item) => total + item.total_cents, 0)
  const totalCents = Math.max(
    0,
    productsTotalCents
      + loaded.document.freight_cents
      + loaded.document.insurance_cents
      + loaded.document.other_expenses_cents
      - loaded.document.discount_cents,
  )
  await auth.supabase
    .from('inbound_nfe_documents')
    .update({
      total_cents: totalCents,
      fiscal_payments: fiscalPaymentsForTotal(loaded.document.fiscal_payments, totalCents),
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('id', documentId)

  return getInboundNfeDocument(auth, documentId)
}

export async function cloneInboundNfeDocument (auth: AuthCtx, documentId: string) {
  const loaded = await getInboundNfeDocument(auth, documentId)
  if (!loaded.ok) return loaded

  const source = loaded.document
  const number = await nextInboundNumber(auth)
  const { data: insertedRaw, error } = await auth.supabase
    .from('inbound_nfe_documents')
    .insert({
      organization_id: auth.organizationId,
      entry_kind: source.entry_kind,
      source_mode: 'manual',
      entry_type: source.entry_type === 'xml_import' ? 'third_party' : source.entry_type,
      access_key: null,
      series: source.series,
      number,
      issued_at: new Date().toISOString(),
      issuer_cnpj: null,
      issuer_name: source.seller_name,
      recipient_cnpj: null,
      recipient_name: null,
      seller_customer_id: source.seller_customer_id,
      seller_name: source.seller_name,
      seller_document: source.seller_document,
      fiscal_purpose: source.fiscal_purpose,
      should_move_stock: source.should_move_stock,
      operation_nature: source.operation_nature,
      import_declaration: null,
      freight_cents: source.freight_cents,
      insurance_cents: source.insurance_cents,
      other_expenses_cents: source.other_expenses_cents,
      discount_cents: source.discount_cents,
      transport_mode: source.transport_mode,
      complementary_information: source.complementary_information,
      fiscal_information: source.fiscal_information,
      fiscal_payments: source.fiscal_payments,
      purchase_payment_methods: source.purchase_payment_methods,
      total_cents: source.total_cents,
      status: 'draft',
      xml_content: null,
      notes: source.notes,
      created_by: auth.userId,
    })
    .select('id')
    .single()

  const inserted = asRowWithId(insertedRaw)
  if (error || !inserted) {
    console.error('[inbound-nfe] clone document', error)
    return { ok: false as const, error: 'db_error' as const, message: 'Não foi possível clonar a entrada.' }
  }

  const itemRows = (source.items || []).map((item) => ({
    organization_id: auth.organizationId,
    inbound_nfe_id: inserted.id,
    line_number: item.line_number,
    item_kind: item.item_kind,
    product_code: item.product_code,
    barcode: item.barcode,
    description: item.description,
    ncm: item.ncm,
    cest: item.cest,
    unit: item.unit,
    cfop: item.cfop,
    fiscal_origin: item.fiscal_origin,
    icms_csosn: item.icms_csosn,
    icms_cst: item.icms_cst,
    pis_cst: item.pis_cst,
    cofins_cst: item.cofins_cst,
    ipi_cst: item.ipi_cst,
    quantity: item.quantity,
    unit_value_cents: item.unit_value_cents,
    total_cents: item.total_cents,
    product_id: item.product_id,
    device_snapshot: item.device_snapshot,
  }))

  if (itemRows.length > 0) {
    const { error: itemsError } = await auth.supabase.from('inbound_nfe_items').insert(itemRows)
    if (itemsError) {
      console.error('[inbound-nfe] clone items', itemsError)
      await auth.supabase.from('inbound_nfe_documents').delete().eq('id', inserted.id)
      return { ok: false as const, error: 'db_error' as const, message: 'Não foi possível clonar os itens.' }
    }
  }

  return getInboundNfeDocument(auth, inserted.id)
}

async function postProductsInbound (auth: AuthCtx, documentId: string, doc: InboundNfeDocumentRow) {
  const items = doc.items || []
  const linked = items.filter((item) => item.product_id)
  if (linked.length === 0) {
    return {
      ok: false as const,
      error: 'unlinked_items' as const,
      message: 'Vincule ao menos um item a um produto para lançar no estoque. Os demais podem ficar sem vínculo.',
    }
  }

  const service = createSupabaseServiceClient()

  for (const item of items) {
    // Itens sem cadastro ficam de fora do estoque.
    if (!item.product_id) continue
    // Retry após falha parcial: não relança itens já vinculados a movimento.
    if (item.stock_movement_id) continue

    const quantity = stockQuantityFromXml(item.quantity)
    if (!quantity) {
      return {
        ok: false as const,
        error: 'invalid_quantity' as const,
        message: `Quantidade inválida no item "${item.description}". Use quantidades inteiras para estoque.`,
      }
    }
    const { data: kindRow } = await service
      .from('products')
      .select('kind')
      .eq('id', item.product_id)
      .eq('organization_id', auth.organizationId)
      .maybeSingle()

    if (!kindRow || String(kindRow.kind || '') === 'service') {
      return {
        ok: false as const,
        error: 'invalid_product' as const,
        message: `O item "${item.description}" está vinculado a um serviço.`,
      }
    }

    const { data: children } = await service
      .from('products')
      .select('id')
      .eq('organization_id', auth.organizationId)
      .eq('parent_product_id', item.product_id)
      .limit(1)
    if ((children || []).length > 0) {
      return {
        ok: false as const,
        error: 'parent_product_no_stock' as const,
        message: `O item "${item.description}" está vinculado a um produto pai com variações. Vincule a variação.`,
      }
    }

    const externalReference = inboundNfeItemStockExternalReference({
      accessKey: doc.access_key,
      documentId,
      itemId: item.id,
    })

    // Idempotência se o vínculo no item falhou após o insert do movimento.
    const { data: existingMovement } = await service
      .from('product_stock_movements')
      .select('id')
      .eq('organization_id', auth.organizationId)
      .eq('source', 'nfe_entrada')
      .eq('external_reference', externalReference)
      .maybeSingle()

    let movementId = existingMovement?.id
      ? String(existingMovement.id)
      : null

    if (!movementId) {
      const unitValueCents = Math.max(0, Math.round(item.unit_value_cents || 0))
      const { data: movement, error: movementError } = await service
        .from('product_stock_movements')
        .insert({
          organization_id: auth.organizationId,
          product_id: item.product_id,
          type: 'entry',
          quantity,
          unit_value_cents: unitValueCents,
          total_value_cents: unitValueCents * quantity,
          source: 'nfe_entrada',
          external_reference: externalReference,
          created_by: auth.userId,
        })
        .select('id')
        .single()

      if (movementError || !movement) {
        if (String(movementError?.code || '') === '23505') {
          const { data: raced } = await service
            .from('product_stock_movements')
            .select('id')
            .eq('organization_id', auth.organizationId)
            .eq('source', 'nfe_entrada')
            .eq('external_reference', externalReference)
            .maybeSingle()
          if (raced?.id) {
            movementId = String(raced.id)
          } else {
            console.error('[inbound-nfe] stock insert', movementError)
            return {
              ok: false as const,
              error: 'stock_error' as const,
              message: `Não foi possível lançar estoque do item "${item.description}".`,
            }
          }
        } else {
          console.error('[inbound-nfe] stock insert', movementError)
          return {
            ok: false as const,
            error: 'stock_error' as const,
            message: `Não foi possível lançar estoque do item "${item.description}".`,
          }
        }
      } else {
        movementId = String(movement.id)
      }

      if (unitValueCents > 0) {
        const { fetchProductHasVirtualStock, persistDependentVirtualKitCosts } = await import(
          '@/lib/products/virtual-stock-cost'
        )
        const isVirtual = await fetchProductHasVirtualStock({
          supabase: service,
          organizationId: auth.organizationId,
          productId: item.product_id,
        })
        if (!isVirtual) {
          await service
            .from('products')
            .update({
              cost_price_cents: unitValueCents,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.product_id)
            .eq('organization_id', auth.organizationId)
          await persistDependentVirtualKitCosts({
            supabase: service,
            organizationId: auth.organizationId,
            componentProductId: item.product_id,
          })
        }
      }
    }

    await service
      .from('inbound_nfe_items')
      .update({
        stock_movement_id: movementId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .eq('organization_id', auth.organizationId)
  }

  const { data: marked, error: statusError } = await service
    .from('inbound_nfe_documents')
    .update({
      status: 'posted',
      posted_at: new Date().toISOString(),
      posted_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('organization_id', auth.organizationId)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle()

  if (statusError) {
    console.error('[inbound-nfe] mark posted', statusError)
    return {
      ok: false as const,
      error: 'db_error' as const,
      message: 'Estoque lançado, mas não foi possível marcar a nota como lançada.',
    }
  }

  if (!marked) {
    const reloaded = await getInboundNfeDocument(auth, documentId)
    if (reloaded.ok && reloaded.document.status === 'posted') return reloaded
    return {
      ok: false as const,
      error: 'db_error' as const,
      message: 'Estoque lançado, mas não foi possível marcar a nota como lançada.',
    }
  }

  return getInboundNfeDocument(auth, documentId)
}

async function postUsedDevicesInbound (auth: AuthCtx, documentId: string, doc: InboundNfeDocumentRow) {
  const items = doc.items || []
  const service = createSupabaseServiceClient()
  const purchaseDate = (doc.issued_at || new Date().toISOString()).slice(0, 10)
  const payments = parsePurchasePayments(doc.purchase_payment_methods, doc.total_cents)

  for (const item of items) {
    // Retry após falha parcial: não recria aparelhos já vinculados.
    if (item.resale_device_id) continue

    const snapshot = item.device_snapshot
    const deviceName = cleanText(snapshot?.device_name || item.description)
    if (!deviceName) {
      return {
        ok: false as const,
        error: 'device_name_required' as const,
        message: 'Há aparelho sem nome na entrada.',
      }
    }

    const purchaseValueCents = Math.max(0, Math.round(item.unit_value_cents || 0))
    const devicePaymentCents = allocateDevicePaymentCents(payments, purchaseValueCents)
    const devicePayments = payments
      .map((payment, index) => ({
        ...payment,
        value_cents: devicePaymentCents[index] ?? 0,
      }))
      .filter((payment) => payment.value_cents > 0)
    const { data: deviceRaw, error: deviceError } = await service
      .from('resale_devices')
      .insert({
        organization_id: auth.organizationId,
        device_name: deviceName,
        color: snapshot?.color || null,
        storage_gb: snapshot?.storage_gb || null,
        battery: snapshot?.battery || null,
        condition: snapshot?.condition || null,
        info: snapshot?.info || null,
        imei: snapshot?.imei || null,
        imei2: snapshot?.imei2 || null,
        serial: snapshot?.serial || null,
        purchase_value_cents: purchaseValueCents,
        purchase_date: purchaseDate,
        sale_value_cents: snapshot?.sale_value_cents ?? null,
        sold: false,
        stock_type: 'seminovo',
        acquisition_source: 'customer_purchase',
        seller_customer_id: doc.seller_customer_id,
        seller_name: doc.seller_name,
        seller_document: doc.seller_document,
        purchase_payment_methods: devicePayments.length > 0 ? devicePayments : null,
        advertised: false,
        tested: false,
        image_gallery_paths: [],
      })
      .select('id, device_name, model, purchase_value_cents, purchase_payment_methods, purchase_date, updated_at')
      .single()

    const device = deviceRaw as unknown as {
      id: string
      device_name: string | null
      model: string | null
      updated_at: string | null
    } | null

    if (deviceError || !device?.id) {
      console.error('[inbound-nfe] used device insert', deviceError)
      return {
        ok: false as const,
        error: 'device_error' as const,
        message: `Não foi possível cadastrar o aparelho "${deviceName}".`,
      }
    }

    await service
      .from('inbound_nfe_items')
      .update({
        resale_device_id: device.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .eq('organization_id', auth.organizationId)

    try {
      await syncResaleDevicePurchaseFinancialTransactions({
        supabase: auth.supabase,
        organizationId: auth.organizationId,
        resaleDeviceId: device.id,
        deviceRow: {
          id: device.id,
          organization_id: auth.organizationId,
          device_name: device.device_name ?? null,
          model: device.model ?? null,
          acquisition_source: 'customer_purchase',
          purchase_value_cents: purchaseValueCents,
          purchase_payment_methods: devicePayments,
          purchase_date: purchaseDate,
          updated_at: device.updated_at ?? null,
        },
      })
    } catch (err) {
      console.error('[inbound-nfe] used finance sync', err)
    }
  }

  const { data: marked, error: statusError } = await service
    .from('inbound_nfe_documents')
    .update({
      status: 'posted',
      posted_at: new Date().toISOString(),
      posted_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('organization_id', auth.organizationId)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle()

  if (statusError) {
    console.error('[inbound-nfe] mark used posted', statusError)
    return {
      ok: false as const,
      error: 'db_error' as const,
      message: 'Aparelhos criados, mas não foi possível marcar a nota como lançada.',
    }
  }

  if (!marked) {
    const reloaded = await getInboundNfeDocument(auth, documentId)
    if (reloaded.ok && reloaded.document.status === 'posted') return reloaded
    return {
      ok: false as const,
      error: 'db_error' as const,
      message: 'Aparelhos criados, mas não foi possível marcar a nota como lançada.',
    }
  }

  return getInboundNfeDocument(auth, documentId)
}

export async function postInboundNfeToStock (auth: AuthCtx, documentId: string) {
  const loaded = await getInboundNfeDocument(auth, documentId)
  if (!loaded.ok) return loaded
  const doc = loaded.document
  if (doc.status !== 'draft') {
    return {
      ok: false as const,
      error: 'already_posted' as const,
      message: 'Esta NF-e já foi lançada ou cancelada.',
    }
  }
  if (!doc.should_move_stock) {
    return {
      ok: false as const,
      error: 'stock_movement_disabled' as const,
      message: 'A movimentação de estoque está desativada para esta entrada.',
    }
  }

  const items = doc.items || []
  if (items.length === 0) {
    return { ok: false as const, error: 'empty_items' as const, message: 'A NF-e não possui itens.' }
  }

  if (doc.entry_kind === 'used_devices') {
    return postUsedDevicesInbound(auth, documentId, doc)
  }
  return postProductsInbound(auth, documentId, doc)
}
