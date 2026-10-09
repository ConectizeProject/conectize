import { onlyDigits } from '@/lib/utils/strings'

/** CSOSN típicos de ST no Simples Nacional. */
const ST_CSOSN = new Set(['201', '202', '203', '500'])

/** CSOSN típicos de venda tributada/não tributada sem ST no Simples. */
const NON_ST_CSOSN = new Set(['101', '102', '103', '300', '400'])

/** CFOPs de saída com ST (dentro do estado, 5xxx). */
const ST_CFOP = new Set([
  '5401',
  '5402',
  '5403',
  '5405',
  '6404',
  '6405',
  '5408',
  '5409',
  '5410',
  '5411',
  '5414',
  '5415',
  '5651',
  '5652',
  '5653',
  '5654',
  '5655',
  '5656',
])

/** CFOPs de saída sem ST (dentro do estado). */
const NON_ST_CFOP = new Set([
  '5101',
  '5102',
  '5103',
  '5104',
  '5105',
  '5106',
  '5110',
  '5111',
  '5112',
  '5113',
  '5114',
  '5115',
  '5116',
  '5117',
  '5118',
  '5119',
  '5120',
  '5122',
  '5123',
  '5124',
  '5125',
])

function interstateVariant (cfop: string) {
  if (cfop.startsWith('5')) return `6${cfop.slice(1)}`
  if (cfop.startsWith('6')) return `5${cfop.slice(1)}`
  return cfop
}

export function normalizeOptionalCfop (value: unknown): string | null | 'invalid' {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const digits = onlyDigits(raw)
  if (digits.length !== 4) return 'invalid'
  return digits
}

export function normalizeOptionalCsosn (value: unknown): string | null | 'invalid' {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const digits = onlyDigits(raw)
  if (digits.length !== 3) return 'invalid'
  return digits
}

export function cfopForDestination (cfop: string, emitUf: string, destUf: string | null) {
  const digits = onlyDigits(cfop).slice(0, 4)
  if (!digits) return '5102'
  if (!destUf || destUf.toUpperCase() === emitUf.toUpperCase()) return digits
  if (digits.startsWith('5')) return `6${digits.slice(1)}`
  if (digits.startsWith('1')) return `2${digits.slice(1)}`
  return digits
}

/**
 * Venda de mercadoria: o cadastro diz se o produto tem ST (CEST preenchido).
 * Mesmo estado: 5102 + CSOSN 102, ou 5405 + CSOSN 500.
 * Outro estado: 6102, ou 6405 (par interestadual do 5405, contribuinte substituído).
 * Não usar 6404 aqui: 6404 é de contribuinte substituto, incompatível com CSOSN 500.
 */
export function resolveSaleItemTaxes (input: {
  hasSubstitution: boolean
  emitUf: string
  destUf?: string | null
}) {
  const emit = String(input.emitUf || '').trim().toUpperCase()
  const dest = String(input.destUf || '').trim().toUpperCase()
  const interstate = Boolean(dest) && dest !== emit
  if (input.hasSubstitution) {
    return {
      cfop: interstate ? '6405' : '5405',
      csosn: '500',
      operationIsSt: true,
    }
  }
  return {
    cfop: interstate ? '6102' : '5102',
    csosn: '102',
    operationIsSt: false,
  }
}

export function resolveItemCfop (input: {
  productCfop?: string | null
  natureCfop?: string | null
  profileCfop?: string | null
  emitUf: string
  destUf?: string | null
}) {
  const base = onlyDigits(input.productCfop || '')
    || onlyDigits(input.natureCfop || '')
    || onlyDigits(input.profileCfop || '')
    || '5102'
  return cfopForDestination(base.slice(0, 4), input.emitUf, input.destUf ?? null)
}

export function resolveItemCsosn (input: {
  productCsosn?: string | null
  natureCsosn?: string | null
  profileCsosn?: string | null
}) {
  return onlyDigits(input.productCsosn || '').slice(0, 3)
    || onlyDigits(input.natureCsosn || '').slice(0, 3)
    || onlyDigits(input.profileCsosn || '').slice(0, 3)
    || '102'
}

const ST_ICMS_CST = new Set(['10', '30', '60', '70'])

export function isStCfop (cfop: string) {
  const digits = onlyDigits(cfop).slice(0, 4)
  return ST_CFOP.has(digits) || ST_CFOP.has(interstateVariant(digits))
}

function isNonStCfop (cfop: string) {
  const digits = onlyDigits(cfop).slice(0, 4)
  return NON_ST_CFOP.has(digits) || NON_ST_CFOP.has(interstateVariant(digits))
}

/**
 * CFOP sem ST (5102/6102) não pode sair com CSOSN ou CST de substituição tributária.
 * A SEFAZ trata CSOSN 500 e CST 60 como operação com ST e rejeita se faltar CEST.
 */
export function alignItemTaxesToCfop (input: {
  cfop: string
  csosn: string
  icmsCst?: string | null
}) {
  const cfop = onlyDigits(input.cfop).slice(0, 4)
  let csosn = onlyDigits(input.csosn).slice(0, 3) || '102'
  let icmsCst = onlyDigits(input.icmsCst || '').slice(0, 3) || null
  const operationIsSt = isStCfop(cfop)
  const operationWithoutSt = isNonStCfop(cfop)

  if (operationWithoutSt && ST_CSOSN.has(csosn)) csosn = '102'
  if (operationIsSt && NON_ST_CSOSN.has(csosn)) csosn = '500'
  if (operationWithoutSt && icmsCst && ST_ICMS_CST.has(icmsCst)) icmsCst = '00'

  return { cfop, csosn, icmsCst, operationIsSt }
}

/**
 * Rejeição SEFAZ 386: CFOP não permitido para o CSOSN.
 * Valida os pares mais comuns do Simples Nacional em NFC-e.
 */
export function validateCfopCsosnPair (cfopRaw: string, csosnRaw: string): {
  ok: true
} | {
  ok: false
  error: 'cfop_csosn_mismatch'
  message: string
} {
  const cfop = onlyDigits(cfopRaw).slice(0, 4)
  const csosn = onlyDigits(csosnRaw).slice(0, 3)
  if (!cfop || !csosn) return { ok: true }

  if (ST_CSOSN.has(csosn) && isNonStCfop(cfop)) {
    return {
      ok: false,
      error: 'cfop_csosn_mismatch',
      message: `CFOP ${cfop} não combina com CSOSN ${csosn}. Para CSOSN ${csosn} (ST), use CFOP 5405 (ou outro CFOP de ST). Para venda sem ST, use CFOP 5102 com CSOSN 102.`,
    }
  }

  if (NON_ST_CSOSN.has(csosn) && isStCfop(cfop)) {
    return {
      ok: false,
      error: 'cfop_csosn_mismatch',
      message: `CFOP ${cfop} não combina com CSOSN ${csosn}. CFOP ${cfop} é de ST; use CSOSN 500 (ou 201/202/203). Para venda sem ST, use CFOP 5102 com CSOSN 102.`,
    }
  }

  return { ok: true }
}
