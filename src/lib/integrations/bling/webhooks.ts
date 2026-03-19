/**
 * Tipos e utilitários para webhooks do Bling.
 * Centraliza parsing, external_id e mapeamento para efeitos locais (produto/estoque).
 */

export type BlingWebhookStatus = 'pending' | 'processed' | 'error'

/** Estrutura base que o Bling pode enviar (genérico; ajustar conforme documentação oficial). */
export type BlingWebhookBase = {
  id?: string | number
  event?: string
  resource?: string
  timestamp?: string
  data?: Record<string, unknown>
  produto?: BlingWebhookProductPayload
  estoque?: BlingWebhookStockPayload
}

export type BlingWebhookProductPayload = {
  id?: number | string
  nome?: string
  codigo?: string
  gtin?: string
  descricao?: string
  situacao?: string
  preco?: number
  custo?: number
  estoqueAtual?: number
}

export type BlingWebhookStockPayload = {
  id?: number | string
  produto?: { id?: number | string }
  quantidade?: number
  estoqueAtual?: number
}

export type BlingWebhookParsedProduct = {
  kind: 'product'
  eventType: string
  externalId: string
  productId: string
  payload: BlingWebhookProductPayload
  raw: Record<string, unknown>
}

export type BlingWebhookParsedStock = {
  kind: 'stock'
  eventType: string
  externalId: string
  productId: string
  estoqueAtual: number
  payload: BlingWebhookStockPayload | BlingWebhookProductPayload
  raw: Record<string, unknown>
}

/** Webhook `stock.created`: movimento no Bling + saldo virtual atualizado (referência para o portal). */
export type BlingWebhookParsedStockMovement = {
  kind: 'stockMovement'
  eventType: string
  externalId: string
  productId: string
  operacao: 'E' | 'S'
  quantidade: number
  /** Saldo virtual total após o movimento (prioridade para alinhar estoque local). */
  saldoVirtualTotal: number | null
  /** Saldo virtual só do depósito do evento (fallback se não vier total). */
  saldoVirtualDeposito: number | null
  saldoFisicoTotal: number | null
  depositoId: string | null
  eventId: string | null
  occurredAt: string | null
  raw: Record<string, unknown>
}

export type BlingWebhookParsedUnknown = {
  kind: 'unknown'
  eventType: string
  externalId: string | null
  raw: Record<string, unknown>
}

export type BlingWebhookParsed =
  | BlingWebhookParsedProduct
  | BlingWebhookParsedStock
  | BlingWebhookParsedStockMovement
  | BlingWebhookParsedUnknown

/** Extrai external_id (id do recurso no Bling) a partir do evento parseado. */
export function getBlingResourceKeyFromWebhook (evt: BlingWebhookParsed): string | null {
  if (evt.kind === 'unknown') return evt.externalId
  return evt.externalId || null
}

const STOCK_CREATED_EVENT = 'stock.created'

function parseStockCreatedPayload (payload: Record<string, unknown>): BlingWebhookParsedStockMovement | null {
  const eventId = payload.eventId != null ? String(payload.eventId).trim() : null
  const data = payload.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const d = data as Record<string, unknown>
  const prod = d.produto
  if (!prod || typeof prod !== 'object' || Array.isArray(prod)) return null
  const blingProductId = (prod as { id?: unknown }).id
  if (blingProductId == null || blingProductId === '') return null
  const operacaoRaw = String(d.operacao ?? '').trim().toUpperCase()
  if (operacaoRaw !== 'E' && operacaoRaw !== 'S') return null
  const quantidade = Number(d.quantidade)
  if (!Number.isFinite(quantidade) || quantidade <= 0) return null
  const deposito = d.deposito
  const depositoId = deposito && typeof deposito === 'object' && !Array.isArray(deposito) && (deposito as { id?: unknown }).id != null
    ? String((deposito as { id: unknown }).id)
    : null
  const saldoFisicoTotal = typeof d.saldoFisicoTotal === 'number' && Number.isFinite(d.saldoFisicoTotal)
    ? d.saldoFisicoTotal
    : null
  const saldoVirtualTotal = typeof d.saldoVirtualTotal === 'number' && Number.isFinite(d.saldoVirtualTotal)
    ? d.saldoVirtualTotal
    : null
  let saldoVirtualDeposito: number | null = null
  if (deposito && typeof deposito === 'object' && !Array.isArray(deposito)) {
    const sv = (deposito as { saldoVirtual?: unknown }).saldoVirtual
    if (typeof sv === 'number' && Number.isFinite(sv)) saldoVirtualDeposito = sv
  }
  const occurredAt = typeof payload.date === 'string' && payload.date.trim() !== '' ? payload.date.trim() : null

  return {
    kind: 'stockMovement',
    eventType: STOCK_CREATED_EVENT,
    externalId: String(blingProductId),
    productId: String(blingProductId),
    operacao: operacaoRaw,
    quantidade,
    saldoVirtualTotal,
    saldoVirtualDeposito,
    saldoFisicoTotal,
    depositoId,
    eventId,
    occurredAt,
    raw: payload,
  }
}

/** Eventos de produto conhecidos (ajustar conforme doc Bling). */
const PRODUCT_EVENTS = new Set([
  'produto.created',
  'produto.updated',
  'produto.deleted',
  'product.created',
  'product.updated',
  'product.deleted',
])

/** Eventos de estoque conhecidos (sincronização por saldo total / legado). */
const STOCK_EVENTS = new Set([
  'produto.estoque',
  'estoque.updated',
  'stock.updated',
  'product.stock',
])

function safePayload (raw: unknown): Record<string, unknown> {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return {}
}

function extractProductId (p: BlingWebhookBase): string {
  const prod = p.produto ?? (p.data as Record<string, unknown>)?.produto
  if (prod && typeof prod === 'object') {
    const id = (prod as BlingWebhookProductPayload).id
    if (id != null) return String(id)
  }
  const data = p.data ?? {}
  const id = (data as Record<string, unknown>).id ?? (data as Record<string, unknown>).produtoId
  if (id != null) return String(id)
  return ''
}

function extractStockValue (p: BlingWebhookBase): number {
  const prod = p.produto ?? (p.data as Record<string, unknown>)?.produto
  if (prod && typeof prod === 'object') {
    const v = (prod as BlingWebhookProductPayload).estoqueAtual
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  const est = p.estoque ?? (p.data as Record<string, unknown>)?.estoque
  if (est && typeof est === 'object') {
    const v = (est as BlingWebhookStockPayload).estoqueAtual ?? (est as BlingWebhookStockPayload).quantidade
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  const data = p.data ?? {}
  const v = (data as Record<string, unknown>).estoqueAtual ?? (data as Record<string, unknown>).quantidade
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return 0
}

/**
 * Parse do payload bruto do webhook Bling.
 * Retorna união discriminada por kind: product | stock | stockMovement | unknown.
 */
export function parseBlingWebhook (raw: unknown): BlingWebhookParsed {
  const payload = safePayload(raw)
  const eventType = String(payload.event ?? payload.type ?? payload.evento ?? '').trim() || 'unknown'
  const productId = extractProductId(payload as BlingWebhookBase)
  const externalId = productId || String(payload.id ?? payload.resourceId ?? '').trim() || null

  if (eventType === STOCK_CREATED_EVENT) {
    const movement = parseStockCreatedPayload(payload)
    if (movement) return movement
  }

  if (PRODUCT_EVENTS.has(eventType) || (eventType.includes('produto') || eventType.includes('product'))) {
    const prod = (payload.produto ?? (payload.data as Record<string, unknown>)?.produto ?? payload) as BlingWebhookProductPayload
    return {
      kind: 'product',
      eventType,
      externalId: productId || externalId || 'unknown',
      productId: productId || externalId || 'unknown',
      payload: prod && typeof prod === 'object' ? prod : {},
      raw: payload,
    }
  }

  if (
    STOCK_EVENTS.has(eventType)
    || (eventType.includes('estoque') || eventType.includes('stock'))
  ) {
    if (eventType === STOCK_CREATED_EVENT) {
      return {
        kind: 'unknown',
        eventType,
        externalId,
        raw: payload,
      }
    }
    const estoqueAtual = extractStockValue(payload as BlingWebhookBase)
    const prod = (payload.produto ?? (payload.data as Record<string, unknown>)?.produto ?? payload.estoque ?? payload) as BlingWebhookStockPayload | BlingWebhookProductPayload
    return {
      kind: 'stock',
      eventType,
      externalId: productId || externalId || 'unknown',
      productId: productId || externalId || 'unknown',
      estoqueAtual,
      payload: prod && typeof prod === 'object' ? prod : {},
      raw: payload,
    }
  }

  return {
    kind: 'unknown',
    eventType,
    externalId,
    raw: payload,
  }
}

/** Ação interna sugerida a partir do evento (para o serviço de processamento). */
export type WebhookLocalEffect =
  | { action: 'updateProduct'; blingId: string; payload: BlingWebhookProductPayload }
  | { action: 'syncStock'; blingId: string; estoqueAtual: number }
  | {
      action: 'insertStockMovementFromBling'
      blingId: string
      /** Saldo virtual alvo no portal (Bling). Se null, usa só operacao + quantidade como delta. */
      targetVirtualStock: number | null
      blingOperacao: 'E' | 'S'
      blingQuantidade: number
      externalReference: string
      occurredAtIso: string | null
      saldoVirtualTotal: number | null
      saldoFisicoTotal: number | null
      depositoId: string | null
    }
  | { action: 'skip'; reason: string }

/**
 * Mapeia evento parseado para efeito de alto nível (updateProduct / syncStock / skip).
 */
export function mapWebhookToLocalEffect (evt: BlingWebhookParsed): WebhookLocalEffect {
  if (evt.kind === 'product') {
    return {
      action: 'updateProduct',
      blingId: evt.productId,
      payload: evt.payload,
    }
  }
  if (evt.kind === 'stockMovement') {
    const externalReference = evt.eventId
      ? `bling:stock.created:${evt.eventId}`
      : `bling:stock.created:${evt.productId}:${evt.occurredAt ?? 'nodate'}:${evt.operacao}:${evt.quantidade}`
    const targetVirtualStock = evt.saldoVirtualTotal ?? evt.saldoVirtualDeposito
    const targetOk = targetVirtualStock != null && Number.isFinite(targetVirtualStock)
    return {
      action: 'insertStockMovementFromBling',
      blingId: evt.productId,
      targetVirtualStock: targetOk ? Math.round(Number(targetVirtualStock)) : null,
      blingOperacao: evt.operacao,
      blingQuantidade: evt.quantidade,
      externalReference,
      occurredAtIso: evt.occurredAt,
      saldoVirtualTotal: evt.saldoVirtualTotal,
      saldoFisicoTotal: evt.saldoFisicoTotal,
      depositoId: evt.depositoId,
    }
  }
  if (evt.kind === 'stock') {
    return {
      action: 'syncStock',
      blingId: evt.productId,
      estoqueAtual: evt.estoqueAtual,
    }
  }
  return { action: 'skip', reason: 'unknown_event' }
}
