import 'server-only'
import type { NFeProps, ProdutoProps } from '@brasil-fiscal/nfe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildIbscbsItem, buildIbscbsTot, resolveIbscbsConfig, type IbscbsItem, type NfceIbscbsPayload } from '@/lib/fiscal/ibscbs'
import { lookupIbgeCityCodeFromCep } from '@/lib/fiscal/viacep'
import { onlyDigits } from '@/lib/utils/strings'
import { nfeXmlText, NFE_CPROD_MAX, NFE_INFCPL_MAX, NFE_NATOP_MAX, NFE_UNID_MAX, NFE_XBAIRRO_MAX, NFE_XCPL_MAX, NFE_XFANT_MAX, NFE_XLGR_MAX, NFE_XMUN_MAX, NFE_XNOME_MAX, NFE_XNRO_MAX, NFE_XPROD_MAX } from '@/lib/fiscal/xml-strings'

type FiscalProfile = {
  legal_name?: string | null
  trade_name?: string | null
  cnpj?: string | null
  state_registration?: string | null
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
  fiscal_environment?: 'homologacao' | 'producao'
  ibscbs_enabled?: boolean | null
  ibscbs_cst?: string | null
  ibscbs_cclass_trib?: string | null
}

type BuildInboundInput = {
  supabase: SupabaseClient
  organizationId: string
  inboundNfeId: string
  profile: FiscalProfile
  series: number
  number: number
}

export type BuildInboundNfeResult =
  | { ok: true, payload: NFeProps }
  | { ok: false, error: string, message: string }

function taxRegimeCode (taxRegime?: string | null): 1 | 2 | 3 {
  if (taxRegime === 'simples_excesso_sublimite') return 2
  if (taxRegime === 'regime_normal') return 3
  return 1
}

function toOrigin (value: unknown): 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 {
  const origin = Number(value)
  return Number.isInteger(origin) && origin >= 0 && origin <= 8
    ? origin as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
    : 0
}

function operationNature (purpose: string) {
  if (purpose === 'fixed_asset') return 'Compra de bem para o ativo imobilizado'
  if (purpose === 'use_consumption') return 'Compra de material para uso ou consumo'
  return 'Compra de mercadoria para comercialização'
}

function allowedCfops (purpose: string) {
  if (purpose === 'fixed_asset') return new Set(['1551', '2551'])
  if (purpose === 'use_consumption') return new Set(['1556', '2556'])
  return new Set(['1102', '1403', '2102', '2403'])
}

export async function buildNfeFromInbound (input: BuildInboundInput): Promise<BuildInboundNfeResult> {
  const [{ data: document, error: documentError }, { data: items, error: itemsError }] = await Promise.all([
    input.supabase
      .from('inbound_nfe_documents')
      .select('id, entry_type, fiscal_purpose, seller_customer_id, seller_name, seller_document, total_cents, transport_mode, complementary_information, fiscal_information, fiscal_payments')
      .eq('organization_id', input.organizationId)
      .eq('id', input.inboundNfeId)
      .maybeSingle(),
    input.supabase
      .from('inbound_nfe_items')
      .select('line_number, product_code, barcode, description, ncm, cest, unit, cfop, fiscal_origin, icms_csosn, icms_cst, pis_cst, cofins_cst, ipi_cst, quantity, unit_value_cents, total_cents')
      .eq('organization_id', input.organizationId)
      .eq('inbound_nfe_id', input.inboundNfeId)
      .order('line_number', { ascending: true }),
  ])

  if (documentError || itemsError) {
    return { ok: false, error: 'db_error', message: 'Não foi possível carregar a NF-e de entrada.' }
  }
  if (!document || !items?.length) {
    return { ok: false, error: 'inbound_not_found', message: 'NF-e de entrada não encontrada ou sem itens.' }
  }
  if (document.entry_type !== 'own_issuance') {
    return { ok: false, error: 'invalid_entry_type', message: 'Somente entradas de emissão própria podem ser enviadas à SEFAZ.' }
  }

  const sellerDocument = onlyDigits(document.seller_document || '')
  if ((sellerDocument.length !== 11 && sellerDocument.length !== 14) || !document.seller_customer_id) {
    return { ok: false, error: 'seller_document_required', message: 'Selecione um vendedor com CPF ou CNPJ válido.' }
  }
  const { data: seller } = await input.supabase
    .from('customers')
    .select('company_name, full_name, state_registration, state_registration_exempt, street, street_number, street_complement, neighborhood, city, state, zip_code')
    .eq('organization_id', input.organizationId)
    .eq('id', document.seller_customer_id)
    .maybeSingle()
  if (!seller) {
    return { ok: false, error: 'seller_not_found', message: 'Cadastro do vendedor não encontrado.' }
  }

  const sellerState = String(seller.state || '').trim().toUpperCase()
  const sellerCep = onlyDigits(seller.zip_code || '')
  const sellerCityCode = await lookupIbgeCityCodeFromCep(sellerCep) || ''
  if (
    !seller.street || !seller.street_number || !seller.neighborhood || !seller.city
    || sellerState.length !== 2 || sellerCep.length !== 8 || sellerCityCode.length !== 7
  ) {
    return { ok: false, error: 'seller_address_required', message: 'Complete CEP, logradouro, número, bairro, cidade e UF do vendedor.' }
  }

  const profile = input.profile
  const cnpj = onlyDigits(profile.cnpj || '')
  const ie = onlyDigits(profile.state_registration || '')
  const uf = String(profile.state || '').trim().toUpperCase()
  const ibgeCityCode = onlyDigits(profile.ibge_city_code || '')
  const cep = onlyDigits(profile.zip_code || '')
  if (
    cnpj.length !== 14 || !ie || uf.length !== 2 || ibgeCityCode.length !== 7 || cep.length !== 8
    || !profile.legal_name || !profile.street || !profile.number || !profile.district || !profile.city
  ) {
    return { ok: false, error: 'missing_fiscal_profile', message: 'Complete os dados fiscais e o endereço da Conectize.' }
  }

  const expectedCfops = allowedCfops(String(document.fiscal_purpose || 'resale'))
  const ibscbsConfigResult = resolveIbscbsConfig({
    enabled: profile.ibscbs_enabled,
    cst: profile.ibscbs_cst,
    cClassTrib: profile.ibscbs_cclass_trib,
    taxRegime: profile.tax_regime,
  })
  if (ibscbsConfigResult.ok === false) return ibscbsConfigResult
  const ibscbsItems: IbscbsItem[] = []
  const products: ProdutoProps[] = []

  for (const [index, item] of items.entries()) {
    const ncm = onlyDigits(item.ncm || '')
    const cfop = onlyDigits(item.cfop || '')
    const csosn = onlyDigits(item.icms_csosn || '')
    const pisCst = onlyDigits(item.pis_cst || '')
    const cofinsCst = onlyDigits(item.cofins_cst || '')
    const quantity = Number(item.quantity)
    const unitValue = Math.round(Number(item.unit_value_cents || 0)) / 100
    const totalValue = Math.round(Number(item.total_cents || 0)) / 100
    const description = nfeXmlText(item.description, NFE_XPROD_MAX)
    if (!description || ncm.length !== 8 || cfop.length !== 4 || csosn.length !== 3 || pisCst.length !== 2 || cofinsCst.length !== 2) {
      return { ok: false, error: 'invalid_item_fiscal_data', message: `Revise os dados fiscais do item ${index + 1}.` }
    }
    if (!expectedCfops.has(cfop)) {
      return { ok: false, error: 'cfop_purpose_mismatch', message: `O CFOP ${cfop} do item ${index + 1} não corresponde à finalidade selecionada.` }
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || unitValue <= 0) {
      return { ok: false, error: 'invalid_item_values', message: `Revise quantidade e valor do item ${index + 1}.` }
    }
    const cest = onlyDigits(item.cest || '')
    if (cest && cest.length !== 7) {
      return { ok: false, error: 'invalid_cest', message: `O CEST do item ${index + 1} deve ter 7 dígitos.` }
    }

    const ibsCbs = ibscbsConfigResult.config.include
      ? buildIbscbsItem({ config: ibscbsConfigResult.config, baseCents: Number(item.total_cents || 0) })
      : null
    if (ibsCbs) ibscbsItems.push(ibsCbs)

    products.push({
      numero: index + 1,
      codigo: nfeXmlText(item.product_code, NFE_CPROD_MAX) || String(item.line_number || index + 1),
      descricao: description,
      ncm,
      ...(cest ? { cest } : {}),
      cfop,
      unidade: nfeXmlText(item.unit, NFE_UNID_MAX) || 'UN',
      quantidade: quantity,
      valorUnitario: unitValue,
      valorTotal: totalValue,
      icms: {
        origem: toOrigin(item.fiscal_origin),
        ...(taxRegimeCode(profile.tax_regime) === 3
          ? { cst: onlyDigits(item.icms_cst || '') || '90' }
          : { csosn }),
      },
      pis: { cst: pisCst },
      cofins: { cst: cofinsCst },
      ...(item.ipi_cst ? { ipi: { cst: onlyDigits(item.ipi_cst) } } : {}),
      ...(ibsCbs
        ? {
          ibsCbs: {
            cst: ibsCbs.cst,
            cClassTrib: ibsCbs.cClassTrib,
            pIBSUF: ibsCbs.pIbsUf,
            pIBSMun: ibsCbs.pIbsMun,
            pCBS: ibsCbs.pCbs,
          },
        }
        : {}),
    })
  }

  const paymentsRaw = Array.isArray(document.fiscal_payments) ? document.fiscal_payments : []
  const payments = paymentsRaw.map((payment: Record<string, unknown>) => ({
    formaPagamento: onlyDigits(String(payment.type || '')).slice(0, 2),
    valor: Math.round(Number(payment.value_cents || 0)) / 100,
  }))
  const paymentTotalCents = payments.reduce((total, payment) => total + Math.round(payment.valor * 100), 0)
  if (payments.length === 0 || paymentTotalCents !== Number(document.total_cents || 0)) {
    return { ok: false, error: 'payment_totals_mismatch', message: 'A soma dos pagamentos precisa ser igual ao total da NF-e.' }
  }

  const isHomologacao = profile.fiscal_environment !== 'producao'
  const sellerName = isHomologacao
    ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
    : nfeXmlText(document.seller_name || seller.company_name || seller.full_name, NFE_XNOME_MAX)
  const sellerIe = onlyDigits(seller.state_registration || '')
  const payload: NFeProps & NfceIbscbsPayload = {
    identificacao: {
      modelo: '55',
      naturezaOperacao: nfeXmlText(operationNature(String(document.fiscal_purpose)), NFE_NATOP_MAX),
      tipoOperacao: 0,
      destinoOperacao: sellerState === uf ? 1 : 2,
      finalidade: 1,
      consumidorFinal: 0,
      presencaComprador: 9,
      tipoImpressao: 1,
      tipoEmissao: 1,
      ambiente: isHomologacao ? 2 : 1,
      uf,
      municipio: ibgeCityCode,
      serie: input.series,
      numero: input.number,
      dataEmissao: new Date(),
    },
    emitente: {
      cnpj,
      razaoSocial: nfeXmlText(profile.legal_name, NFE_XNOME_MAX),
      nomeFantasia: nfeXmlText(profile.trade_name, NFE_XFANT_MAX) || undefined,
      inscricaoEstadual: ie,
      inscricaoMunicipal: onlyDigits(profile.municipal_registration || '') || undefined,
      regimeTributario: taxRegimeCode(profile.tax_regime),
      endereco: {
        logradouro: nfeXmlText(profile.street, NFE_XLGR_MAX),
        numero: nfeXmlText(profile.number, NFE_XNRO_MAX),
        complemento: nfeXmlText(profile.complement, NFE_XCPL_MAX) || undefined,
        bairro: nfeXmlText(profile.district, NFE_XBAIRRO_MAX),
        codigoMunicipio: ibgeCityCode,
        municipio: nfeXmlText(profile.city, NFE_XMUN_MAX),
        uf,
        cep,
      },
    },
    destinatario: {
      ...(sellerDocument.length === 14 ? { cnpj: sellerDocument } : { cpf: sellerDocument }),
      nome: sellerName,
      indicadorIE: sellerIe ? 1 : seller.state_registration_exempt ? 2 : 9,
      ...(sellerIe ? { inscricaoEstadual: sellerIe } : {}),
      endereco: {
        logradouro: nfeXmlText(seller.street, NFE_XLGR_MAX),
        numero: nfeXmlText(seller.street_number, NFE_XNRO_MAX),
        complemento: nfeXmlText(seller.street_complement, NFE_XCPL_MAX) || undefined,
        bairro: nfeXmlText(seller.neighborhood, NFE_XBAIRRO_MAX),
        codigoMunicipio: sellerCityCode,
        municipio: nfeXmlText(seller.city, NFE_XMUN_MAX),
        uf: sellerState,
        cep: sellerCep,
      },
    },
    produtos: products,
    transporte: {
      modalidadeFrete: document.transport_mode === 'buyer'
        ? 0
        : document.transport_mode === 'seller'
          ? 1
          : document.transport_mode === 'carrier'
            ? 2
            : 9,
    },
    pagamento: { pagamentos: payments },
    informacoesComplementares: nfeXmlText(
      document.complementary_information || `Entrada própria Conectize, referência ${input.inboundNfeId}`,
      NFE_INFCPL_MAX,
    ) || undefined,
    informacoesFisco: nfeXmlText(document.fiscal_information, NFE_INFCPL_MAX) || undefined,
    ...(ibscbsConfigResult.config.include
      ? {
        ibscbsItems,
        ibscbsTot: buildIbscbsTot(ibscbsItems, Number(document.total_cents || 0) / 100),
      }
      : {}),
  }

  return { ok: true, payload }
}
