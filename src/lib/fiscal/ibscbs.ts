import { onlyDigits } from '@/lib/utils/strings'

type TaxRegime = 'simples_nacional' | 'simples_excesso_sublimite' | 'regime_normal'

export const IBSCBS_CSTS = ['000', '010', '011', '200', '400', '410'] as const

export type IbscbsCst = (typeof IBSCBS_CSTS)[number]

export const IBSCBS_CST_LABELS: Record<IbscbsCst, string> = {
  '000': '000 — Tributação integral',
  '010': '010 — Alíquotas uniformes',
  '011': '011 — Alíquotas uniformes reduzidas',
  '200': '200 — Alíquota zero',
  '400': '400 — Imunidade',
  '410': '410 — Não incidência',
}

const CST_WITH_GIBSCBS = new Set<string>(['000', '010', '011'])

export type IbscbsRates = {
  pIbsUf: number
  pIbsMun: number
  pCbs: number
}

export type IbscbsItem = {
  cst: string
  cClassTrib: string
  vBc: number
  pIbsUf: number
  vIbsUf: number
  pIbsMun: number
  vIbsMun: number
  vIbs: number
  pCbs: number
  vCbs: number
  withGibscbs: boolean
}

export type IbscbsTot = {
  vBc: number
  vIbsUf: number
  vIbsMun: number
  vIbs: number
  vCbs: number
  vNf: number
  vNfTot: number
}

export type IbscbsConfig = {
  include: boolean
  cst: string
  cClassTrib: string
}

export function isIbscbsCst (value: unknown): value is IbscbsCst {
  return IBSCBS_CSTS.includes(String(value || '') as IbscbsCst)
}

export function fiscalIbscbsCstOrNull (value: unknown): string | null {
  const digits = onlyDigits(String(value ?? ''))
  if (!digits) return null
  return digits.padStart(3, '0').slice(-3)
}

export function fiscalIbscbsCclassTribOrNull (cst: string, value: unknown): string | null {
  const digits = onlyDigits(String(value ?? '')).slice(0, 6)
  if (digits.length !== 6) return null
  return cst + digits.slice(3)
}

export function ibscbsStandardRates (at: Date = new Date()): IbscbsRates {
  const year = at.getFullYear()
  if (year <= 2026) {
    return { pIbsUf: 0.1, pIbsMun: 0, pCbs: 0.9 }
  }
  return { pIbsUf: 0.05, pIbsMun: 0.05, pCbs: 0.9 }
}

export function formatIbscbsRate (percent: number) {
  return `${String(percent).replace('.', ',')}%`
}

export function isIbscbsXmlEnabled (input: {
  enabled?: boolean | null
  taxRegime?: TaxRegime | string | null
  at?: Date
}) {
  if (input.enabled === false) return false
  if (input.enabled === true) return true
  if (input.taxRegime === 'regime_normal') return true
  return (input.at || new Date()).getFullYear() >= 2027
}

export function resolveIbscbsConfig (input: {
  enabled?: boolean | null
  cst?: string | null
  cClassTrib?: string | null
  taxRegime?: TaxRegime | string | null
  at?: Date
}): { ok: true, config: IbscbsConfig } | { ok: false, error: string, message: string } {
  const include = isIbscbsXmlEnabled(input)
  const cst = fiscalIbscbsCstOrNull(input.cst || '000') || '000'
  const cClassTrib = fiscalIbscbsCclassTribOrNull(cst, input.cClassTrib || `${cst}001`)
  if (!cClassTrib) {
    return {
      ok: false,
      error: 'invalid_ibscbs_cclass_trib',
      message: 'Informe o cClassTrib do IBS/CBS com 6 dígitos. Os 3 primeiros devem ser iguais ao CST.',
    }
  }
  if (include && !isIbscbsCst(cst)) {
    return {
      ok: false,
      error: 'invalid_ibscbs_cst',
      message: 'Selecione um CST de IBS/CBS válido.',
    }
  }
  return { ok: true, config: { include, cst, cClassTrib } }
}

function taxCents (baseCents: number, percent: number) {
  return Math.round(baseCents * percent / 100)
}

function centsToMoney (cents: number) {
  return Math.round(cents) / 100
}

export function buildIbscbsItem (input: {
  config: IbscbsConfig
  baseCents: number
  at?: Date
}): IbscbsItem {
  const rates = ibscbsStandardRates(input.at)
  const withGibscbs = input.config.include && CST_WITH_GIBSCBS.has(input.config.cst)
  const vIbsUfCents = withGibscbs ? taxCents(input.baseCents, rates.pIbsUf) : 0
  const vIbsMunCents = withGibscbs ? taxCents(input.baseCents, rates.pIbsMun) : 0
  const vCbsCents = withGibscbs ? taxCents(input.baseCents, rates.pCbs) : 0
  return {
    cst: input.config.cst,
    cClassTrib: input.config.cClassTrib,
    vBc: centsToMoney(input.baseCents),
    pIbsUf: rates.pIbsUf,
    vIbsUf: centsToMoney(vIbsUfCents),
    pIbsMun: rates.pIbsMun,
    vIbsMun: centsToMoney(vIbsMunCents),
    vIbs: centsToMoney(vIbsUfCents + vIbsMunCents),
    pCbs: rates.pCbs,
    vCbs: centsToMoney(vCbsCents),
    withGibscbs,
  }
}

export function buildIbscbsTot (items: readonly IbscbsItem[], vNf: number): IbscbsTot {
  const vBc = roundMoney(items.reduce((sum, item) => sum + item.vBc, 0))
  const vIbsUf = roundMoney(items.reduce((sum, item) => sum + item.vIbsUf, 0))
  const vIbsMun = roundMoney(items.reduce((sum, item) => sum + item.vIbsMun, 0))
  const vIbs = roundMoney(vIbsUf + vIbsMun)
  const vCbs = roundMoney(items.reduce((sum, item) => sum + item.vCbs, 0))
  const vNfSafe = roundMoney(vNf)
  return {
    vBc,
    vIbsUf,
    vIbsMun,
    vIbs,
    vCbs,
    vNf: vNfSafe,
    vNfTot: roundMoney(vNfSafe + vIbs + vCbs),
  }
}

export type NfceIbscbsPayload = {
  ibscbsItems?: Array<IbscbsItem | null>
  ibscbsTot?: IbscbsTot | null
}

function roundMoney (value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function moneyXml (value: number) {
  return roundMoney(value).toFixed(2)
}

function rateXml (value: number) {
  return value.toFixed(4)
}

function ibscbsItemXml (item: IbscbsItem) {
  if (!item.withGibscbs) {
    return `<IBSCBS><CST>${item.cst}</CST><cClassTrib>${item.cClassTrib}</cClassTrib></IBSCBS>`
  }
  return [
    '<IBSCBS>',
    `<CST>${item.cst}</CST>`,
    `<cClassTrib>${item.cClassTrib}</cClassTrib>`,
    '<gIBSCBS>',
    `<vBC>${moneyXml(item.vBc)}</vBC>`,
    '<gIBSUF>',
    `<pIBSUF>${rateXml(item.pIbsUf)}</pIBSUF>`,
    `<vIBSUF>${moneyXml(item.vIbsUf)}</vIBSUF>`,
    '</gIBSUF>',
    '<gIBSMun>',
    `<pIBSMun>${rateXml(item.pIbsMun)}</pIBSMun>`,
    `<vIBSMun>${moneyXml(item.vIbsMun)}</vIBSMun>`,
    '</gIBSMun>',
    `<vIBS>${moneyXml(item.vIbs)}</vIBS>`,
    '<gCBS>',
    `<pCBS>${rateXml(item.pCbs)}</pCBS>`,
    `<vCBS>${moneyXml(item.vCbs)}</vCBS>`,
    '</gCBS>',
    '</gIBSCBS>',
    '</IBSCBS>',
  ].join('')
}

function ibscbsTotXml (tot: IbscbsTot) {
  return [
    '<IBSCBSTot>',
    `<vBCIBSCBS>${moneyXml(tot.vBc)}</vBCIBSCBS>`,
    '<gIBS>',
    '<gIBSUF>',
    '<vDif>0.00</vDif>',
    '<vDevTrib>0.00</vDevTrib>',
    `<vIBSUF>${moneyXml(tot.vIbsUf)}</vIBSUF>`,
    '</gIBSUF>',
    '<gIBSMun>',
    '<vDif>0.00</vDif>',
    '<vDevTrib>0.00</vDevTrib>',
    `<vIBSMun>${moneyXml(tot.vIbsMun)}</vIBSMun>`,
    '</gIBSMun>',
    `<vIBS>${moneyXml(tot.vIbs)}</vIBS>`,
    '</gIBS>',
    '<gCBS>',
    '<vDif>0.00</vDif>',
    '<vDevTrib>0.00</vDevTrib>',
    `<vCBS>${moneyXml(tot.vCbs)}</vCBS>`,
    '</gCBS>',
    '</IBSCBSTot>',
    `<vNFTot>${moneyXml(tot.vNfTot)}</vNFTot>`,
  ].join('')
}

export function injectNfceIbscbs (xml: string, payload: NfceIbscbsPayload) {
  const tot = payload.ibscbsTot
  const items = payload.ibscbsItems || []
  if (!tot) return xml

  let index = 0
  const withItems = xml.replace(/<\/imposto>/g, (close) => {
    const item = items[index]
    index += 1
    if (!item) return close
    return `${ibscbsItemXml(item)}${close}`
  })

  return withItems.replace(/<\/ICMSTot>/, `</ICMSTot>${ibscbsTotXml(tot)}`)
}
