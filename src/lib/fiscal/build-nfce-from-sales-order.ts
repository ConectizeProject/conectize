import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NFeProps, ProdutoProps } from '@brasil-fiscal/nfe'
import { fiscalFciOrNull, originRequiresFci } from '@/lib/fiscal/fci'
import { fiscalGtinOrNull } from '@/lib/fiscal/gtin'
import { fiscalIeOrNull } from '@/lib/fiscal/ie'
import { validateCestNcmPair } from '@/lib/fiscal/cest-lookup'
import { isNfceServiceItem } from '@/lib/fiscal/certificate-validity'
import { fiscalCestOrNull, fiscalNcmOrNull } from '@/lib/fiscal/ncm'
import { buildNfcePagamentoLine } from '@/lib/fiscal/nfce-payment'
import {
  buildIbscbsItem,
  buildIbscbsTot,
  resolveIbscbsConfig,
  type IbscbsItem,
  type NfceIbscbsPayload,
} from '@/lib/fiscal/ibscbs'
import { onlyDigits } from '@/lib/utils/strings'

type FiscalProfileRow = {
  legal_name?: string | null
  trade_name?: string | null
  cnpj?: string | null
  state_registration?: string | null
  state_registration_exempt?: boolean | null
  municipal_registration?: string | null
  tax_regime?: string | null
  street?: string | null
  number?: string | null
  complement?: string | null
  district?: string | null
  zip_code?: string | null
  city?: string | null
  state?: string | null
  ibge_city_code?: string | null
  default_cfop?: string | null
  default_origin?: number | null
  default_unit?: string | null
  default_csosn?: string | null
  default_pis_cst?: string | null
  default_cofins_cst?: string | null
  ibscbs_enabled?: boolean | null
  ibscbs_cst?: string | null
  ibscbs_cclass_trib?: string | null
  fiscal_environment?: 'homologacao' | 'producao'
}

type FiscalOperationNatureRow = {
  description?: string | null
  operation_type?: 'entrada' | 'saida' | null
  presence_indicator?: number | null
  is_final_consumer?: boolean | null
  default_cfop?: string | null
  default_origin?: number | null
  default_unit?: string | null
  icms_csosn?: string | null
  icms_cst?: string | null
  pis_cst?: string | null
  cofins_cst?: string | null
  ibscbs_enabled?: boolean | null
  ibscbs_cst?: string | null
  ibscbs_cclass_trib?: string | null
}

type BuildNfceInput = {
  supabase: SupabaseClient
  organizationId: string
  orderId: string
  profile: FiscalProfileRow
  operationNature?: FiscalOperationNatureRow | null
  series: number
  number: number
}

export type BuildNfceResult =
  | { ok: true, payload: NFeProps }
  | { ok: false, error: string, message: string }

function centsToValue (cents: unknown) {
  return Math.round(Number(cents || 0)) / 100
}

function toCents (value: unknown) {
  const n = Math.round(Number(value || 0))
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

function allocateCents (amount: number, weights: number[]): number[] {
  const size = weights.length
  const shares = Array.from({ length: size }, () => 0)
  if (size === 0 || amount <= 0) return shares

  const safeWeights = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0))
  const totalWeight = safeWeights.reduce((sum, weight) => sum + weight, 0)
  if (totalWeight <= 0) {
    shares[size - 1] = amount
    return shares
  }

  const raw = safeWeights.map((weight) => (amount * weight) / totalWeight)
  const floors = raw.map((value) => Math.floor(value))
  let remainder = amount - floors.reduce((sum, value) => sum + value, 0)
  const order = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction)

  for (let i = 0; i < order.length && remainder > 0; i += 1) {
    floors[order[i].index] += 1
    remainder -= 1
  }
  return floors
}

function requiredText (value: unknown) {
  return String(value ?? '').trim()
}

function taxRegimeCode (taxRegime?: string | null): 1 | 2 | 3 {
  if (taxRegime === 'simples_excesso_sublimite') return 2
  if (taxRegime === 'regime_normal') return 3
  return 1
}

function productTaxValue (value: unknown, fallback: unknown) {
  const out = String(value ?? fallback ?? '').trim()
  return out || null
}

function toIcmsOrigin (value: unknown): 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 {
  const n = Math.round(Number(value ?? 0))
  if (n >= 0 && n <= 8) return n as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  return 0
}

function toPresenceIndicator (value: unknown): 0 | 1 | 2 | 3 | 4 | 5 | 9 {
  const n = Math.round(Number(value ?? 1))
  if (n === 0 || n === 1 || n === 2 || n === 3 || n === 4 || n === 5 || n === 9) return n
  return 1
}

const HOMOLOGACAO_DEST_NAME = 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'

function buildDestinatario (
  order: { customer_name?: string | null, customer_document?: string | null },
  isHomologacao: boolean,
) {
  const document = onlyDigits(order.customer_document || '')
  const name = isHomologacao
    ? HOMOLOGACAO_DEST_NAME
    : (requiredText(order.customer_name) || 'Consumidor')

  if (document.length === 11) {
    return { cpf: document, nome: name, indicadorIE: 9 as const }
  }
  if (document.length === 14) {
    return { cnpj: document, nome: name, indicadorIE: 9 as const }
  }
  if (isHomologacao) {
    return { nome: name, indicadorIE: 9 as const }
  }
  return undefined
}

export async function buildNfceFromSalesOrder (input: BuildNfceInput): Promise<BuildNfceResult> {
  const { supabase, organizationId, orderId, profile } = input
  const operationNature = input.operationNature ?? null
  const isHomologacao = profile.fiscal_environment !== 'producao'

  const [{ data: order, error: orderError }, { data: items, error: itemsError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase
      .from('sales_orders')
      .select('id, order_number, status, customer_name, customer_document, discount_total_cents, surcharge_cents, total_cents, paid_amount_cents, change_cents, created_at')
      .eq('organization_id', organizationId)
      .eq('id', orderId)
      .maybeSingle(),
    supabase
      .from('sales_order_items')
      .select('quantity, unit_price_cents, discount_cents, subtotal_cents, products(id, name, sku, barcode, kind, ncm, cest, cfop, fiscal_origin, fci, fiscal_unit, icms_csosn, icms_cst, pis_cst, cofins_cst)')
      .eq('organization_id', organizationId)
      .eq('sales_order_id', orderId)
      .order('created_at', { ascending: true }),
    supabase
      .from('sales_order_payments')
      .select('payment_method_type, amount_cents')
      .eq('organization_id', organizationId)
      .eq('sales_order_id', orderId)
      .order('created_at', { ascending: true }),
  ])

  if (orderError || itemsError || paymentsError) {
    return { ok: false, error: 'db_error', message: 'Não foi possível carregar a venda.' }
  }
  if (!order) {
    return { ok: false, error: 'order_not_found', message: 'Venda não encontrada.' }
  }
  if (order.status !== 'paid') {
    return { ok: false, error: 'order_not_paid', message: 'A NFC-e só pode ser emitida para venda paga.' }
  }
  if (!items?.length) {
    return { ok: false, error: 'empty_order', message: 'A venda não possui itens.' }
  }

  const cnpj = onlyDigits(profile.cnpj || '')
  const uf = requiredText(profile.state).toUpperCase()
  const isStateRegistrationExempt = profile.state_registration_exempt === true
  const ie = isStateRegistrationExempt ? 'ISENTO' : (fiscalIeOrNull(profile.state_registration, uf) || '')
  const ibgeCityCode = onlyDigits(profile.ibge_city_code || '')
  if (!cnpj || (!ie && !isStateRegistrationExempt) || !uf || !ibgeCityCode || !profile.street || !profile.number || !profile.district || !profile.city || !profile.zip_code) {
    return { ok: false, error: 'fiscal_profile_incomplete', message: 'Complete CNPJ, IE, endereço fiscal e código IBGE antes de emitir.' }
  }

  const itemNets = items.map((item) => toCents(item.subtotal_cents))
  const orderDiscountShares = allocateCents(toCents(order.discount_total_cents), itemNets)
  const surchargeShares = allocateCents(toCents(order.surcharge_cents), itemNets)
  const fiscalItemCents = itemNets.map((net, index) => Math.max(0, net - orderDiscountShares[index] + surchargeShares[index]))
  const fiscalTotalCents = fiscalItemCents.reduce((sum, value) => sum + value, 0)
  const expectedTotalCents = toCents(order.total_cents)
  if (expectedTotalCents > 0 && fiscalTotalCents !== expectedTotalCents) {
    return {
      ok: false,
      error: 'totals_mismatch',
      message: 'O total da venda não fechou com os itens após o rateio do acréscimo/desconto.',
    }
  }

  const produtos: Array<ProdutoProps & { nFCI?: string }> = []
  const ibscbsResolved = resolveIbscbsConfig({
    enabled: operationNature?.ibscbs_enabled ?? profile.ibscbs_enabled,
    cst: operationNature?.ibscbs_cst || profile.ibscbs_cst,
    cClassTrib: operationNature?.ibscbs_cclass_trib || profile.ibscbs_cclass_trib,
    taxRegime: profile.tax_regime,
  })
  if (ibscbsResolved.ok === false) return ibscbsResolved
  const ibscbsConfig = ibscbsResolved.config
  const ibscbsItems: IbscbsItem[] = []
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const productRaw = item.products
    const product = (Array.isArray(productRaw) ? productRaw[0] : productRaw) as Record<string, unknown> | null
    if (!product) {
      return { ok: false, error: 'product_not_found', message: 'Um item da venda não possui produto vinculado.' }
    }
    const productName = requiredText(product.name) || 'Produto'
    if (isNfceServiceItem(product.kind)) {
      return {
        ok: false,
        error: 'nfce_service_item',
        message: `A NFC-e não aceita serviço. Retire "${productName}" da venda.`,
      }
    }
    const ncm = fiscalNcmOrNull(productTaxValue(product.ncm, null))
    if (!ncm) {
      return {
        ok: false,
        error: 'product_missing_ncm',
        message: `Informe o NCM com 8 dígitos de "${productName}".`,
      }
    }
    const cest = product.cest ? fiscalCestOrNull(product.cest) : null
    if (product.cest && !cest) {
      return {
        ok: false,
        error: 'product_invalid_cest',
        message: `Informe o CEST com 7 dígitos de "${productName}" ou deixe em branco.`,
      }
    }
    const cestPair = await validateCestNcmPair(ncm, cest, productName)
    if (cestPair.ok === false) {
      return {
        ok: false,
        error: cestPair.error,
        message: cestPair.message,
      }
    }

    const cfop = onlyDigits(operationNature?.default_cfop || profile.default_cfop || '')
    const quantity = Math.max(1, Number(item.quantity) || 1)
    const valorTotal = centsToValue(fiscalItemCents[index])
    const valorUnitario = quantity > 0 ? valorTotal / quantity : valorTotal
    const csosn = onlyDigits(operationNature?.icms_csosn || profile.default_csosn || '') || '102'
    const icmsCst = onlyDigits(operationNature?.icms_cst || '') || null
    const gtin = fiscalGtinOrNull(product.barcode)
    const origem = toIcmsOrigin(product.fiscal_origin ?? operationNature?.default_origin ?? profile.default_origin)
    const fci = fiscalFciOrNull(product.fci)
    if (originRequiresFci(origem) && !fci) {
      return {
        ok: false,
        error: 'product_missing_fci',
        message: `Informe o FCI (UUID) de "${productName}". Origens 3, 5 e 8 exigem a Ficha de Conteúdo de Importação.`,
      }
    }

    const ibscbs = ibscbsConfig.include
      ? buildIbscbsItem({ config: ibscbsConfig, baseCents: fiscalItemCents[index] })
      : null
    if (ibscbs) ibscbsItems.push(ibscbs)

    produtos.push({
      numero: index + 1,
      codigo: requiredText(product.sku) || requiredText(product.id) || String(index + 1),
      descricao: requiredText(product.name) || 'Produto',
      ncm,
      ...(cest ? { cest } : {}),
      cfop: cfop || '5102',
      unidade: productTaxValue(product.fiscal_unit, operationNature?.default_unit ?? profile.default_unit) || 'UN',
      quantidade: quantity,
      valorUnitario,
      valorTotal,
      ...(gtin ? { ean: gtin, eanTributavel: gtin } : {}),
      ...(fci ? { nFCI: fci } : {}),
      icms: {
        origem,
        ...(taxRegimeCode(profile.tax_regime) === 3 && icmsCst
          ? { cst: icmsCst }
          : { csosn }),
      },
      pis: { cst: onlyDigits(operationNature?.pis_cst || profile.default_pis_cst || '') || '49' },
      cofins: { cst: onlyDigits(operationNature?.cofins_cst || profile.default_cofins_cst || '') || '49' },
    })
  }

  if (isHomologacao && produtos[0]) {
    produtos[0] = { ...produtos[0], descricao: HOMOLOGACAO_DEST_NAME }
  }

  const pagamentos = (payments || []).map((payment) => buildNfcePagamentoLine({
    paymentMethodType: payment.payment_method_type,
    amount: centsToValue(payment.amount_cents),
  }))

  if (pagamentos.length === 0) {
    return { ok: false, error: 'missing_payments', message: 'A venda não possui pagamentos para a NFC-e.' }
  }

  const paidCents = (payments || []).reduce((sum, payment) => sum + toCents(payment.amount_cents), 0)
  const changeCents = toCents(order.change_cents)
  if (paidCents - changeCents !== fiscalTotalCents) {
    return {
      ok: false,
      error: 'payment_totals_mismatch',
      message: 'A soma dos pagamentos menos o troco precisa ser igual ao total da NFC-e.',
    }
  }

  const payload: NFeProps & NfceIbscbsPayload = {
    identificacao: {
      modelo: '65',
      naturezaOperacao: requiredText(operationNature?.description) || 'Venda de mercadoria',
      tipoOperacao: 1,
      destinoOperacao: 1,
      finalidade: 1,
      consumidorFinal: 1,
      presencaComprador: toPresenceIndicator(operationNature?.presence_indicator),
      tipoImpressao: 4,
      tipoEmissao: 1,
      ambiente: profile.fiscal_environment === 'producao' ? 1 : 2,
      uf,
      municipio: ibgeCityCode,
      serie: input.series,
      numero: input.number,
      dataEmissao: new Date(),
    },
    emitente: {
      cnpj,
      razaoSocial: requiredText(profile.legal_name),
      nomeFantasia: requiredText(profile.trade_name) || undefined,
      inscricaoEstadual: ie,
      inscricaoMunicipal: requiredText(profile.municipal_registration) || undefined,
      regimeTributario: taxRegimeCode(profile.tax_regime),
      endereco: {
        logradouro: requiredText(profile.street),
        numero: requiredText(profile.number),
        complemento: requiredText(profile.complement) || undefined,
        bairro: requiredText(profile.district),
        codigoMunicipio: ibgeCityCode,
        municipio: requiredText(profile.city),
        uf,
        cep: onlyDigits(profile.zip_code || ''),
      },
    },
    destinatario: buildDestinatario(order, isHomologacao),
    produtos,
    transporte: { modalidadeFrete: 9 },
    pagamento: {
      pagamentos,
      troco: centsToValue(order.change_cents),
    },
    informacoesComplementares: `Venda Conectize #${order.order_number}`,
    ...(ibscbsConfig.include
      ? {
        ibscbsItems,
        ibscbsTot: buildIbscbsTot(ibscbsItems, centsToValue(fiscalTotalCents)),
      }
      : {}),
  }

  return {
    ok: true,
    payload,
  }
}
