import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NFeProps, ProdutoProps } from '@brasil-fiscal/nfe'
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
  fiscal_environment?: 'homologacao' | 'producao'
}

type BuildNfceInput = {
  supabase: SupabaseClient
  organizationId: string
  orderId: string
  profile: FiscalProfileRow
  series: number
  number: number
}

export type BuildNfceResult =
  | { ok: true, payload: NFeProps, submittedXmlPlaceholder: string }
  | { ok: false, error: string, message: string }

const PAYMENT_TO_TPAG: Record<string, string> = {
  dinheiro: '01',
  credito: '03',
  debito: '04',
  pix: '17',
  outro: '99',
}

function centsToValue (cents: unknown) {
  return Math.round(Number(cents || 0)) / 100
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

function buildDestinatario (order: { customer_name?: string | null, customer_document?: string | null }) {
  const document = onlyDigits(order.customer_document || '')
  const name = requiredText(order.customer_name) || 'Consumidor'
  if (document.length === 11) {
    return { cpf: document, nome: name, indicadorIE: 9 as const }
  }
  if (document.length === 14) {
    return { cnpj: document, nome: name, indicadorIE: 9 as const }
  }
  return undefined
}

export async function buildNfceFromSalesOrder (input: BuildNfceInput): Promise<BuildNfceResult> {
  const { supabase, organizationId, orderId, profile } = input

  const [{ data: order, error: orderError }, { data: items, error: itemsError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase
      .from('sales_orders')
      .select('id, order_number, status, customer_name, customer_document, total_cents, change_cents, created_at')
      .eq('organization_id', organizationId)
      .eq('id', orderId)
      .maybeSingle(),
    supabase
      .from('sales_order_items')
      .select('quantity, unit_price_cents, discount_cents, subtotal_cents, products(id, name, sku, barcode, ncm, cest, cfop, fiscal_origin, fiscal_unit, icms_csosn, icms_cst, pis_cst, cofins_cst)')
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
  const isStateRegistrationExempt = profile.state_registration_exempt === true
  const ie = isStateRegistrationExempt ? 'ISENTO' : onlyDigits(profile.state_registration || '')
  const uf = requiredText(profile.state).toUpperCase()
  const ibgeCityCode = onlyDigits(profile.ibge_city_code || '')
  if (!cnpj || (!ie && !isStateRegistrationExempt) || !uf || !ibgeCityCode || !profile.street || !profile.number || !profile.district || !profile.city || !profile.zip_code) {
    return { ok: false, error: 'fiscal_profile_incomplete', message: 'Complete CNPJ, IE, endereço fiscal e código IBGE antes de emitir.' }
  }

  const produtos: ProdutoProps[] = []
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const productRaw = item.products
    const product = (Array.isArray(productRaw) ? productRaw[0] : productRaw) as Record<string, unknown> | null
    if (!product) {
      return { ok: false, error: 'product_not_found', message: 'Um item da venda não possui produto vinculado.' }
    }
    const ncm = onlyDigits(productTaxValue(product.ncm, null) || '')
    if (!ncm) {
      return { ok: false, error: 'product_missing_ncm', message: `Informe o NCM de "${requiredText(product.name) || 'Produto'}".` }
    }

    const cfop = onlyDigits(productTaxValue(product.cfop, profile.default_cfop) || '')
    const quantity = Math.max(1, Number(item.quantity) || 1)
    const valorUnitario = centsToValue(item.unit_price_cents)
    const valorTotal = centsToValue(item.subtotal_cents)
    const csosn = productTaxValue(product.icms_csosn, profile.default_csosn) || '102'
    const icmsCst = productTaxValue(product.icms_cst, null)

    produtos.push({
      numero: index + 1,
      codigo: requiredText(product.sku) || requiredText(product.id) || String(index + 1),
      descricao: requiredText(product.name) || 'Produto',
      ncm,
      ...(product.cest ? { cest: onlyDigits(String(product.cest)) } : {}),
      cfop: cfop || '5102',
      unidade: productTaxValue(product.fiscal_unit, profile.default_unit) || 'UN',
      quantidade: quantity,
      valorUnitario,
      valorTotal,
      valorDesconto: centsToValue(item.discount_cents),
      ...(product.barcode ? { ean: onlyDigits(String(product.barcode)), eanTributavel: onlyDigits(String(product.barcode)) } : {}),
      icms: {
        origem: toIcmsOrigin(product.fiscal_origin ?? profile.default_origin),
        ...(taxRegimeCode(profile.tax_regime) === 3 && icmsCst
          ? { cst: icmsCst }
          : { csosn }),
      },
      pis: { cst: productTaxValue(product.pis_cst, profile.default_pis_cst) || '49' },
      cofins: { cst: productTaxValue(product.cofins_cst, profile.default_cofins_cst) || '49' },
    })
  }

  const pagamentos = (payments || []).map((payment) => ({
    formaPagamento: PAYMENT_TO_TPAG[String(payment.payment_method_type || '')] || '99',
    valor: centsToValue(payment.amount_cents),
  }))

  const payload: NFeProps = {
    identificacao: {
      modelo: '65',
      naturezaOperacao: 'Venda de mercadoria',
      tipoOperacao: 1,
      destinoOperacao: 1,
      finalidade: 1,
      consumidorFinal: 1,
      presencaComprador: 1,
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
    destinatario: buildDestinatario(order),
    produtos,
    transporte: { modalidadeFrete: 9 },
    pagamento: {
      pagamentos,
      troco: centsToValue(order.change_cents),
    },
    informacoesComplementares: `Venda Conectize #${order.order_number}`,
  }

  return {
    ok: true,
    payload,
    submittedXmlPlaceholder: JSON.stringify({
      model: '65',
      orderId,
      orderNumber: order.order_number,
      series: input.series,
      number: input.number,
    }),
  }
}
