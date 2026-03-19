export type LocalProduct = {
  id?: string
  blingId?: string | null
  parentBlingId?: string | null
  name: string
  sku?: string | null
  barcode?: string | null
  description?: string | null
  imageUrl?: string | null
  kind?: 'product' | 'service' | null
  salePriceCents?: number | null
  costPriceCents?: number | null
  isActive?: boolean
  /** Estoque atual no Bling; usado na importação para criar/alinhar movimentos. */
  estoqueAtual?: number
}

export type LocalStockMovement = {
  type: 'entry' | 'exit' | 'loss'
  quantity: number
  unitValueCents: number
  totalValueCents: number
  source: 'bling' | 'manual' | 'system'
  externalReference?: string | null
  createdAt?: string
}

/** API Bling v3: listagem retorna estoque em estoque.saldoVirtualTotal, custo em precoCusto; código de barras em gtin ou codigoBarras. */
type BlingProductDto = {
  id?: number | string
  /** ID do produto pai (variação) — pode vir flat ou só dentro de produtoPai. */
  idProdutoPai?: number | string
  produtoPai?: { id?: number | string }
  produto_pai?: { id?: number | string }
  pai?: { id?: number | string }
  nome?: string
  codigo?: string
  gtin?: string
  codigoBarras?: string
  descricao?: string
  descricaoCurta?: string
  situacao?: string
  tipo?: string
  preco?: number
  custo?: number
  precoCusto?: number
  estoqueAtual?: number
  quantidadeEstoque?: number
  estoque?: { saldoVirtualTotal?: number }
  imagemURL?: string
}

function getBarcode (dto: BlingProductDto): string | null {
  const v = dto.gtin ?? dto.codigoBarras
  if (v == null || v === '') return null
  const s = String(v).trim()
  return s || null
}

function getCostCents (dto: BlingProductDto): number | null {
  const raw = dto.precoCusto ?? dto.custo
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  return Math.round(raw * 100)
}

function getStock (dto: BlingProductDto): number | undefined {
  const fromNested = typeof dto.estoque?.saldoVirtualTotal === 'number' && Number.isFinite(dto.estoque.saldoVirtualTotal)
    ? dto.estoque.saldoVirtualTotal
    : undefined
  const fromRoot = typeof dto.estoqueAtual === 'number' && dto.estoqueAtual >= 0 ? dto.estoqueAtual : undefined
  const fromQty = typeof dto.quantidadeEstoque === 'number' && dto.quantidadeEstoque >= 0 ? dto.quantidadeEstoque : undefined
  const n = fromNested ?? fromRoot ?? fromQty
  return n !== undefined && Number.isFinite(n) ? Number(n) : undefined
}

/** idProdutoPai no Bling pode vir como número/string ou só em produtoPai.id / produto_pai.id. */
function extractParentBlingIdFromDto (raw: Record<string, unknown>): string | null {
  const asTrimmed = (v: unknown): string | null => {
    if (v == null || v === '') return null
    if (typeof v === 'number' && (!Number.isFinite(v) || v === 0)) return null
    const s = String(v).trim()
    if (!s || s === '0') return null
    return s
  }

  const flat =
    asTrimmed(raw.idProdutoPai)
    ?? asTrimmed(raw.id_produto_pai)
    ?? asTrimmed(raw.produtoPaiId)
  if (flat) return flat

  const fromNestedObject = (obj: unknown): string | null => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
    return asTrimmed((obj as Record<string, unknown>).id)
  }

  return (
    fromNestedObject(raw.produtoPai)
    ?? fromNestedObject(raw.produto_pai)
    ?? fromNestedObject(raw.pai)
    ?? null
  )
}

export function mapBlingProductToLocal (dto: BlingProductDto): LocalProduct {
  const id = dto.id != null ? String(dto.id) : null
  const parentId = extractParentBlingIdFromDto(dto as Record<string, unknown>)
  const name = String(dto.nome || '').trim()
  const barcode = getBarcode(dto)
  const costCents = getCostCents(dto)
  const estoqueAtual = getStock(dto)
  const imageUrl = dto.imagemURL ? String(dto.imagemURL).trim() : null
  const tipo = (dto.tipo || '').toString().toUpperCase()
  const kind: 'product' | 'service' | null =
    tipo === 'P' ? 'product'
      : tipo === 'S' ? 'service'
        : null

  const situacao = (dto.situacao || '').toString().trim().toUpperCase()
  const isActive = situacao
    ? situacao !== 'INATIVO' && situacao !== 'I'
    : true

  return {
    blingId: id,
    parentBlingId: parentId,
    name,
    sku: dto.codigo ? String(dto.codigo).trim() : null,
    barcode: barcode ?? null,
    description: (dto.descricao ?? dto.descricaoCurta) ? String(dto.descricao ?? dto.descricaoCurta ?? '').trim() : null,
    salePriceCents: typeof dto.preco === 'number' && Number.isFinite(dto.preco) ? Math.round(dto.preco * 100) : null,
    costPriceCents: costCents,
    isActive,
    imageUrl,
    kind,
    estoqueAtual,
  }
}

export function mapLocalProductToBling (product: LocalProduct): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if (product.name) payload.nome = product.name
  if (product.sku !== undefined) payload.codigo = product.sku ?? ''
  if (product.barcode !== undefined) payload.gtin = product.barcode ?? ''
  if (product.description !== undefined) payload.descricao = product.description ?? ''
  if (typeof product.salePriceCents === 'number') payload.preco = product.salePriceCents / 100
  if (typeof product.costPriceCents === 'number') payload.custo = product.costPriceCents / 100
  if (typeof product.isActive === 'boolean') {
    payload.situacao = product.isActive ? 'A' : 'I'
  }
  if (product.kind === 'product') payload.tipo = 'P'
  if (product.kind === 'service') payload.tipo = 'S'

  return payload
}

