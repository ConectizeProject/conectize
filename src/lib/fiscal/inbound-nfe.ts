import 'server-only'
import type { PortalAuthStaffSuccess } from '@/lib/auth/portal-api'
import { inboundNfeItemStockExternalReference } from '@/lib/fiscal/inbound-nfe-stock-ref'
import { parseInboundNfeXml } from '@/lib/fiscal/parse-inbound-nfe-xml'
import { syncResaleDevicePurchaseFinancialTransactions } from '@/lib/finance/service-order-financial-sync'
import {
  coerceRawSalePaymentsToArray,
  mapLooseEntryToSalePaymentRow,
} from '@/lib/resale/sale-payment-methods'
import { onlyDigits } from '@/lib/utils/strings'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

type AuthCtx = PortalAuthStaffSuccess

export type InboundNfeStatus = 'draft' | 'posted' | 'canceled'
export type InboundEntryKind = 'products' | 'used_devices'
export type InboundSourceMode = 'xml' | 'manual'
export type InboundItemKind = 'product' | 'used_device'

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
  purchase_payment_methods: unknown
  total_cents: number
  status: InboundNfeStatus
  notes: string | null
  posted_at: string | null
  created_at: string
  updated_at: string
  items?: InboundNfeItemRow[]
}

export type ManualProductLineInput = {
  description: string
  quantity: number
  unitValueCents: number
  productId?: string | null
  productCode?: string | null
  barcode?: string | null
  ncm?: string | null
  unit?: string | null
}

export type UsedDeviceLineInput = {
  device: UsedDeviceSnapshot
  purchaseValueCents: number
}

const DOC_SELECT = [
  'id',
  'entry_kind',
  'source_mode',
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

  return {
    ok: true as const,
    documents: (data || []) as unknown as InboundNfeDocumentRow[],
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

  return {
    ok: true as const,
    document: {
      ...(doc as unknown as InboundNfeDocumentRow),
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
    return { ok: false as const, error: 'db_error' as const, message: 'Não foi possível salvar a NF-e importada.' }
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
    await auth.supabase
      .from('inbound_nfe_documents')
      .delete()
      .eq('id', inserted.id)
      .eq('organization_id', auth.organizationId)
    return { ok: false as const, error: 'db_error' as const, message: 'Não foi possível salvar os itens da NF-e.' }
  }

  return getInboundNfeDocument(auth, inserted.id)
}

export async function createManualProductsInbound (
  auth: AuthCtx,
  input: {
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
    lines.push({
      description,
      quantity,
      unitValueCents,
      productId: raw.productId || null,
      productCode: cleanText(raw.productCode) || null,
      barcode: onlyDigits(raw.barcode || '') || null,
      ncm: onlyDigits(raw.ncm || '') || null,
      unit: cleanText(raw.unit || 'UN').toUpperCase().slice(0, 6) || 'UN',
    })
  }

  const totalCents = lines.reduce(
    (sum, line) => sum + Math.round(line.unitValueCents * line.quantity),
    0,
  )
  const number = await nextInboundNumber(auth)
  const issuedAt = input.issuedAt ? new Date(input.issuedAt).toISOString() : new Date().toISOString()

  const { data: insertedRaw, error } = await auth.supabase
    .from('inbound_nfe_documents')
    .insert({
      organization_id: auth.organizationId,
      entry_kind: 'products',
      source_mode: 'manual',
      access_key: null,
      series: 1,
      number,
      issued_at: Number.isNaN(new Date(issuedAt).getTime()) ? new Date().toISOString() : issuedAt,
      issuer_name: cleanText(input.issuerName) || null,
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
    unit: line.unit,
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

export async function linkInboundNfeItem (
  auth: AuthCtx,
  documentId: string,
  itemId: string,
  productId: string | null,
) {
  const loaded = await getInboundNfeDocument(auth, documentId)
  if (!loaded.ok) return loaded
  if (loaded.document.status !== 'draft') {
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

async function postProductsInbound (auth: AuthCtx, documentId: string, doc: InboundNfeDocumentRow) {
  const items = doc.items || []
  const unlinked = items.filter((item) => !item.product_id)
  if (unlinked.length > 0) {
    return {
      ok: false as const,
      error: 'unlinked_items' as const,
      message: `Vincule todos os itens a produtos antes de lançar no estoque (${unlinked.length} pendente(s)).`,
    }
  }

  const service = createSupabaseServiceClient()

  for (const item of items) {
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
    if (!item.product_id) continue

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
        await service
          .from('products')
          .update({
            cost_price_cents: unitValueCents,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.product_id)
          .eq('organization_id', auth.organizationId)
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
        purchase_payment_methods: payments.length > 0 ? payments : null,
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
          purchase_payment_methods: payments,
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

  const items = doc.items || []
  if (items.length === 0) {
    return { ok: false as const, error: 'empty_items' as const, message: 'A NF-e não possui itens.' }
  }

  if (doc.entry_kind === 'used_devices') {
    return postUsedDevicesInbound(auth, documentId, doc)
  }
  return postProductsInbound(auth, documentId, doc)
}
