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

function isStCfop (cfop: string) {
  return ST_CFOP.has(cfop) || ST_CFOP.has(interstateVariant(cfop))
}

function isNonStCfop (cfop: string) {
  return NON_ST_CFOP.has(cfop) || NON_ST_CFOP.has(interstateVariant(cfop))
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
