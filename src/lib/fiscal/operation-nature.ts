import 'server-only'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { onlyDigits } from '@/lib/utils/strings'
import { nfceNumberingForEnvironment, type FiscalNumberingProfileRow } from '@/lib/fiscal/numbering'
import type { TaxRegime } from '@/lib/fiscal/profile'

export type FiscalDocumentModel = '55' | '65'
export type FiscalOperationType = 'entrada' | 'saida'

export type FiscalOperationNatureInput = {
  documentModel: FiscalDocumentModel
  name: string
  description: string
  series: number
  operationType: FiscalOperationType
  taxRegime: TaxRegime
  presenceIndicator: number
  isBilled: boolean
  isFinalConsumer: boolean
  isReturn: boolean
  defaultCfop: string
  defaultOrigin: number
  defaultUnit: string
  icmsCsosn: string | null
  icmsCst: string | null
  pisCst: string
  cofinsCst: string
}

export type FiscalOperationNatureRow = {
  id: string
  organization_id: string
  document_model: FiscalDocumentModel
  name: string
  description: string
  series: number
  operation_type: FiscalOperationType
  tax_regime: TaxRegime
  presence_indicator: number
  is_billed: boolean
  is_final_consumer: boolean
  is_return: boolean
  default_cfop: string
  default_origin: number
  default_unit: string
  icms_csosn: string | null
  icms_cst: string | null
  pis_cst: string
  cofins_cst: string
  is_default: boolean
  is_active: boolean
}

function textOrFallback (value: unknown, fallback: string) {
  const text = String(value ?? '').trim()
  return text || fallback
}

function normalizeTaxRegime (value: unknown): TaxRegime {
  if (value === 'simples_excesso_sublimite' || value === 'regime_normal') return value
  return 'simples_nacional'
}

function normalizeOperationType (value: unknown): FiscalOperationType {
  return value === 'entrada' ? 'entrada' : 'saida'
}

export function normalizeFiscalOperationNatureInput (
  raw: Partial<FiscalOperationNatureInput>,
): FiscalOperationNatureInput {
  const documentModel: FiscalDocumentModel = raw.documentModel === '55' ? '55' : '65'
  const defaultOrigin = Number.isFinite(Number(raw.defaultOrigin))
    ? Math.min(8, Math.max(0, Math.round(Number(raw.defaultOrigin))))
    : 0
  const presenceIndicator = Number.isFinite(Number(raw.presenceIndicator))
    ? Math.min(9, Math.max(0, Math.round(Number(raw.presenceIndicator))))
    : 1

  return {
    documentModel,
    name: textOrFallback(raw.name, documentModel === '65' ? 'Venda de Mercadoria NFC-e' : 'Venda de Mercadoria NF-e'),
    description: textOrFallback(raw.description, 'Venda de Mercadoria'),
    series: Math.max(1, Math.round(Number(raw.series) || 1)),
    operationType: documentModel === '65' ? 'saida' : normalizeOperationType(raw.operationType),
    taxRegime: normalizeTaxRegime(raw.taxRegime),
    presenceIndicator,
    isBilled: raw.isBilled !== false,
    isFinalConsumer: documentModel === '65' ? true : raw.isFinalConsumer !== false,
    isReturn: documentModel === '65' ? false : Boolean(raw.isReturn),
    defaultCfop: onlyDigits(raw.defaultCfop || '').slice(0, 4) || '5102',
    defaultOrigin,
    defaultUnit: String(raw.defaultUnit || 'UN').trim().toUpperCase().slice(0, 6) || 'UN',
    icmsCsosn: onlyDigits(raw.icmsCsosn || '').slice(0, 3) || null,
    icmsCst: onlyDigits(raw.icmsCst || '').slice(0, 3) || null,
    pisCst: onlyDigits(raw.pisCst || '').slice(0, 2) || '49',
    cofinsCst: onlyDigits(raw.cofinsCst || '').slice(0, 2) || '49',
  }
}

export function operationNatureFromProfileFallback (
  profile: Record<string, unknown> | null | undefined,
  model: FiscalDocumentModel,
): FiscalOperationNatureInput {
  return normalizeFiscalOperationNatureInput({
    documentModel: model,
    name: model === '65' ? 'Venda de Mercadoria NFC-e' : 'Venda de Mercadoria NF-e',
    description: 'Venda de Mercadoria',
    series: model === '65'
      ? nfceNumberingForEnvironment(
        (profile || {}) as FiscalNumberingProfileRow,
        profile?.fiscal_environment === 'producao' ? 'producao' : 'homologacao',
      ).series
      : Number(profile?.nfe_series || 1),
    operationType: 'saida',
    taxRegime: normalizeTaxRegime(profile?.tax_regime),
    presenceIndicator: 1,
    isBilled: true,
    isFinalConsumer: true,
    isReturn: false,
    defaultCfop: String(profile?.default_cfop || '5102'),
    defaultOrigin: Number(profile?.default_origin ?? 0),
    defaultUnit: String(profile?.default_unit || 'UN'),
    icmsCsosn: String(profile?.default_csosn || '102'),
    icmsCst: null,
    pisCst: String(profile?.default_pis_cst || '49'),
    cofinsCst: String(profile?.default_cofins_cst || '49'),
  })
}

export async function getDefaultFiscalOperationNature (
  organizationId: string,
  model: FiscalDocumentModel,
): Promise<FiscalOperationNatureRow | null> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('organization_fiscal_operation_natures')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('document_model', model)
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle()

  return data as FiscalOperationNatureRow | null
}

export async function upsertDefaultFiscalOperationNature (
  organizationId: string,
  input: FiscalOperationNatureInput,
) {
  const supabase = createSupabaseServiceClient()
  const existing = await getDefaultFiscalOperationNature(organizationId, input.documentModel)
  const payload = {
    organization_id: organizationId,
    document_model: input.documentModel,
    name: input.name,
    description: input.description,
    series: input.series,
    operation_type: input.operationType,
    tax_regime: input.taxRegime,
    presence_indicator: input.presenceIndicator,
    is_billed: input.isBilled,
    is_final_consumer: input.isFinalConsumer,
    is_return: input.isReturn,
    default_cfop: input.defaultCfop,
    default_origin: input.defaultOrigin,
    default_unit: input.defaultUnit,
    icms_csosn: input.icmsCsosn,
    icms_cst: input.icmsCst,
    pis_cst: input.pisCst,
    cofins_cst: input.cofinsCst,
    is_default: true,
    is_active: true,
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('organization_fiscal_operation_natures')
      .update(payload)
      .eq('id', existing.id)
      .eq('organization_id', organizationId)
    if (error) {
      console.error('[fiscal operation nature] failed to update default nature', error)
      return { ok: false as const, error: 'db_error' as const }
    }
    return { ok: true as const }
  }

  const { error } = await supabase
    .from('organization_fiscal_operation_natures')
    .insert(payload)
  if (error) {
    console.error('[fiscal operation nature] failed to insert default nature', error)
    return { ok: false as const, error: 'db_error' as const }
  }
  return { ok: true as const }
}
