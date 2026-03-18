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
  idProdutoPai?: number | string
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

export function mapBlingProductToLocal (dto: BlingProductDto): LocalProduct {
  const id = dto.id != null ? String(dto.id) : null
  const parentId = dto.idProdutoPai != null ? String(dto.idProdutoPai) : null
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

  return {
    blingId: id,
    parentBlingId: parentId,
    name,
    sku: dto.codigo ? String(dto.codigo).trim() : null,
    barcode: barcode ?? null,
    description: (dto.descricao ?? dto.descricaoCurta) ? String(dto.descricao ?? dto.descricaoCurta ?? '').trim() : null,
    salePriceCents: typeof dto.preco === 'number' && Number.isFinite(dto.preco) ? Math.round(dto.preco * 100) : null,
    costPriceCents: costCents,
    isActive: dto.situacao ? dto.situacao.toLowerCase() !== 'inativo' && dto.situacao.toLowerCase() !== 'i' : true,
    imageUrl,
    kind,
    estoqueAtual,
  }
}

export function mapLocalProductToBling (product: LocalProduct): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if (product.name) payload.nome = product.name
  if (product.sku) payload.codigo = product.sku
  if (product.barcode) payload.gtin = product.barcode
  if (product.description) payload.descricao = product.description
  if (typeof product.salePriceCents === 'number') payload.preco = product.salePriceCents / 100
  if (typeof product.costPriceCents === 'number') payload.custo = product.costPriceCents / 100
  if (typeof product.isActive === 'boolean') {
    payload.situacao = product.isActive ? 'Ativo' : 'Inativo'
  }

  return payload
}

