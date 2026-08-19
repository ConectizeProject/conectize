import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { onlyDigits } from '@/lib/utils/strings'
import { fiscalIeOrNull } from '@/lib/fiscal/ie'
import {
  decryptFiscalSecretToBuffer,
  decryptFiscalSecretToString,
  encryptFiscalSecret,
} from '@/lib/fiscal/secrets'
import {
  FISCAL_CERTIFICATE_MAX_BYTES,
  type FiscalCertificateMetadata,
  validateFiscalCertificate,
} from '@/lib/fiscal/certificate'

export type FiscalEnvironment = 'homologacao' | 'producao'
export type TaxRegime = 'simples_nacional' | 'simples_excesso_sublimite' | 'regime_normal'

export type FiscalProfileInput = {
  legalName: string | null
  tradeName: string | null
  cnpj: string | null
  stateRegistration: string | null
  stateRegistrationExempt: boolean
  municipalRegistration: string | null
  taxRegime: TaxRegime
  street: string | null
  number: string | null
  complement: string | null
  district: string | null
  zipCode: string | null
  city: string | null
  state: string | null
  ibgeCityCode: string | null
  nfceCscIdHomologacao: string | null
  nfceCscHomologacao: string | null
  nfceCscIdProducao: string | null
  nfceCscProducao: string | null
  nfceSeriesHomologacao: number
  nfceNextNumberHomologacao: number
  nfceSeriesProducao: number
  nfceNextNumberProducao: number
  nfceSeries: number
  nfceNextNumber: number
  nfeSeries: number
  nfeNextNumber: number
  fiscalEnvironment: FiscalEnvironment
  nfceEnabled: boolean
  defaultCfop: string
  defaultOrigin: number
  defaultUnit: string
  defaultCsosn: string
  defaultPisCst: string
  defaultCofinsCst: string
}

export type FiscalCertificatePublic = FiscalCertificateMetadata & {
  hasCertificate: boolean
}

export type FiscalCertificateSecret = FiscalCertificateMetadata & {
  pfxBuffer: Buffer
  password: string
}

function nullIfEmpty (value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

export function normalizeFiscalProfileInput (raw: Partial<FiscalProfileInput>): FiscalProfileInput {
  const taxRegime = raw.taxRegime === 'simples_excesso_sublimite' || raw.taxRegime === 'regime_normal'
    ? raw.taxRegime
    : 'simples_nacional'
  const fiscalEnvironment = raw.fiscalEnvironment === 'producao' ? 'producao' : 'homologacao'
  const defaultOrigin = Number.isFinite(Number(raw.defaultOrigin))
    ? Math.min(8, Math.max(0, Math.round(Number(raw.defaultOrigin))))
    : 0
  const nfceSeriesHomologacao = Math.max(1, Math.round(Number(raw.nfceSeriesHomologacao) || 1))
  const nfceNextNumberHomologacao = Math.max(1, Math.round(Number(raw.nfceNextNumberHomologacao) || 1))
  const nfceSeriesProducao = Math.max(1, Math.round(Number(raw.nfceSeriesProducao) || 1))
  const nfceNextNumberProducao = Math.max(1, Math.round(Number(raw.nfceNextNumberProducao) || 1))

  return {
    legalName: nullIfEmpty(raw.legalName),
    tradeName: nullIfEmpty(raw.tradeName),
    cnpj: onlyDigits(raw.cnpj || '').slice(0, 14) || null,
    stateRegistration: fiscalIeOrNull(raw.stateRegistration, raw.state),
    stateRegistrationExempt: Boolean(raw.stateRegistrationExempt),
    municipalRegistration: nullIfEmpty(raw.municipalRegistration),
    taxRegime,
    street: nullIfEmpty(raw.street),
    number: nullIfEmpty(raw.number),
    complement: nullIfEmpty(raw.complement),
    district: nullIfEmpty(raw.district),
    zipCode: onlyDigits(raw.zipCode || '').slice(0, 8) || null,
    city: nullIfEmpty(raw.city),
    state: String(raw.state || '').trim().toUpperCase().slice(0, 2) || null,
    ibgeCityCode: onlyDigits(raw.ibgeCityCode || '').slice(0, 7) || null,
    nfceCscIdHomologacao: nullIfEmpty(raw.nfceCscIdHomologacao),
    nfceCscHomologacao: nullIfEmpty(raw.nfceCscHomologacao),
    nfceCscIdProducao: nullIfEmpty(raw.nfceCscIdProducao),
    nfceCscProducao: nullIfEmpty(raw.nfceCscProducao),
    nfceSeriesHomologacao,
    nfceNextNumberHomologacao,
    nfceSeriesProducao,
    nfceNextNumberProducao,
    nfceSeries: fiscalEnvironment === 'producao' ? nfceSeriesProducao : nfceSeriesHomologacao,
    nfceNextNumber: fiscalEnvironment === 'producao' ? nfceNextNumberProducao : nfceNextNumberHomologacao,
    nfeSeries: Math.max(1, Math.round(Number(raw.nfeSeries) || 1)),
    nfeNextNumber: Math.max(1, Math.round(Number(raw.nfeNextNumber) || 1)),
    fiscalEnvironment,
    nfceEnabled: Boolean(raw.nfceEnabled),
    defaultCfop: onlyDigits(raw.defaultCfop || '').slice(0, 4) || '5102',
    defaultOrigin,
    defaultUnit: String(raw.defaultUnit || 'UN').trim().toUpperCase().slice(0, 6) || 'UN',
    defaultCsosn: onlyDigits(raw.defaultCsosn || '').slice(0, 3) || '102',
    defaultPisCst: onlyDigits(raw.defaultPisCst || '').slice(0, 2) || '49',
    defaultCofinsCst: onlyDigits(raw.defaultCofinsCst || '').slice(0, 2) || '49',
  }
}

function nextCscCiphertext (incoming: string | null, existing: string | null | undefined) {
  return incoming ? encryptFiscalSecret(incoming) : (existing || null)
}

export async function upsertFiscalProfile (
  _supabase: SupabaseClient,
  organizationId: string,
  input: FiscalProfileInput,
) {
  const supabase = createSupabaseServiceClient()
  const existing = await supabase
    .from('organization_fiscal_profiles')
    .select('nfce_csc_ciphertext, nfce_csc_ciphertext_homologacao, nfce_csc_ciphertext_producao, nfce_csc_id, nfce_csc_id_homologacao, nfce_csc_id_producao')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (existing.error) {
    console.error('[fiscal profile] failed to load existing profile', existing.error)
    return { ok: false as const, error: 'db_error' as const }
  }

  const row = existing.data || {}
  const cscHomologacao = nextCscCiphertext(
    input.nfceCscHomologacao,
    row.nfce_csc_ciphertext_homologacao || row.nfce_csc_ciphertext,
  )
  const cscProducao = nextCscCiphertext(
    input.nfceCscProducao,
    row.nfce_csc_ciphertext_producao,
  )
  const cscIdHomologacao = input.nfceCscIdHomologacao || row.nfce_csc_id_homologacao || row.nfce_csc_id || null
  const cscIdProducao = input.nfceCscIdProducao || row.nfce_csc_id_producao || null
  const activeCsc = input.fiscalEnvironment === 'producao'
    ? { id: cscIdProducao, ciphertext: cscProducao }
    : { id: cscIdHomologacao, ciphertext: cscHomologacao }

  const { error } = await supabase
    .from('organization_fiscal_profiles')
    .upsert({
      organization_id: organizationId,
      legal_name: input.legalName,
      trade_name: input.tradeName,
      cnpj: input.cnpj,
      state_registration: input.stateRegistrationExempt ? null : input.stateRegistration,
      state_registration_exempt: input.stateRegistrationExempt,
      municipal_registration: input.municipalRegistration,
      tax_regime: input.taxRegime,
      street: input.street,
      number: input.number,
      complement: input.complement,
      district: input.district,
      zip_code: input.zipCode,
      city: input.city,
      state: input.state,
      ibge_city_code: input.ibgeCityCode,
      nfce_csc_id: activeCsc.id,
      nfce_csc_ciphertext: activeCsc.ciphertext,
      nfce_csc_id_homologacao: cscIdHomologacao,
      nfce_csc_ciphertext_homologacao: cscHomologacao,
      nfce_csc_id_producao: cscIdProducao,
      nfce_csc_ciphertext_producao: cscProducao,
      nfce_series: input.nfceSeries,
      nfce_next_number: input.nfceNextNumber,
      nfce_series_homologacao: input.nfceSeriesHomologacao,
      nfce_next_number_homologacao: input.nfceNextNumberHomologacao,
      nfce_series_producao: input.nfceSeriesProducao,
      nfce_next_number_producao: input.nfceNextNumberProducao,
      nfe_series: input.nfeSeries,
      nfe_next_number: input.nfeNextNumber,
      fiscal_environment: input.fiscalEnvironment,
      nfce_enabled: input.nfceEnabled,
      default_cfop: input.defaultCfop,
      default_origin: input.defaultOrigin,
      default_unit: input.defaultUnit,
      default_csosn: input.defaultCsosn,
      default_pis_cst: input.defaultPisCst,
      default_cofins_cst: input.defaultCofinsCst,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    console.error('[fiscal profile] failed to upsert profile', error)
    return { ok: false as const, error: 'db_error' as const }
  }
  return { ok: true as const }
}

export async function getFiscalCertificatePublic (organizationId: string): Promise<FiscalCertificatePublic | null> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('organization_fiscal_certificates')
    .select('subject_common_name, subject_cnpj, valid_from, valid_until, fingerprint_sha256')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!data) return null

  return {
    hasCertificate: true,
    subjectCommonName: data.subject_common_name ?? null,
    subjectCnpj: data.subject_cnpj ?? null,
    validFrom: data.valid_from ?? null,
    validUntil: data.valid_until ?? null,
    fingerprintSha256: data.fingerprint_sha256 ?? '',
  }
}

export async function getFiscalCertificateSecret (organizationId: string): Promise<
  | { ok: true, certificate: FiscalCertificateSecret }
  | { ok: false, error: 'not_found' | 'db_error' | 'secret_error' }
> {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('organization_fiscal_certificates')
    .select('pfx_ciphertext, password_ciphertext, subject_common_name, subject_cnpj, valid_from, valid_until, fingerprint_sha256')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) {
    console.error('[fiscal certificate] failed to load secret certificate', error)
    return { ok: false, error: 'db_error' }
  }
  if (!data) return { ok: false, error: 'not_found' }

  try {
    return {
      ok: true,
      certificate: {
        pfxBuffer: decryptFiscalSecretToBuffer(data.pfx_ciphertext),
        password: decryptFiscalSecretToString(data.password_ciphertext),
        subjectCommonName: data.subject_common_name ?? null,
        subjectCnpj: data.subject_cnpj ?? null,
        validFrom: data.valid_from ?? null,
        validUntil: data.valid_until ?? null,
        fingerprintSha256: data.fingerprint_sha256 ?? '',
      },
    }
  } catch (error) {
    console.error('[fiscal certificate] failed to decrypt certificate secret', error)
    return { ok: false, error: 'secret_error' }
  }
}

export async function saveFiscalCertificate (input: {
  organizationId: string
  organizationCnpj?: string | null
  file: File | Blob
  password: string
}) {
  if (!input.file || !(input.file instanceof Blob) || input.file.size <= 0) {
    return { ok: false as const, error: 'invalid_file' as const }
  }

  if (input.file.size > FISCAL_CERTIFICATE_MAX_BYTES) {
    return { ok: false as const, error: 'file_too_large' as const }
  }

  const pfxBuffer = Buffer.from(await input.file.arrayBuffer())
  const validation = validateFiscalCertificate(pfxBuffer, input.password, input.organizationCnpj)
  if (!validation.ok) return validation

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('organization_fiscal_certificates')
    .upsert({
      organization_id: input.organizationId,
      pfx_ciphertext: encryptFiscalSecret(pfxBuffer),
      password_ciphertext: encryptFiscalSecret(input.password),
      subject_common_name: validation.metadata.subjectCommonName,
      subject_cnpj: validation.metadata.subjectCnpj,
      valid_from: validation.metadata.validFrom,
      valid_until: validation.metadata.validUntil,
      fingerprint_sha256: validation.metadata.fingerprintSha256,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    console.error('[fiscal certificate] failed to upsert certificate', error)
    return { ok: false as const, error: 'db_error' as const }
  }
  return { ok: true as const, metadata: validation.metadata }
}
