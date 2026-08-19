import { describe, expect, it } from 'vitest'
import {
  buildIbscbsItem,
  buildIbscbsTot,
  fiscalIbscbsCclassTribOrNull,
  injectNfceIbscbs,
  isIbscbsXmlEnabled,
  resolveIbscbsConfig,
} from '@/lib/fiscal/ibscbs'

describe('isIbscbsXmlEnabled', () => {
  it('keeps Simples off in 2026 unless explicitly enabled', () => {
    expect(isIbscbsXmlEnabled({
      taxRegime: 'simples_nacional',
      at: new Date('2026-08-19'),
    })).toBe(false)
    expect(isIbscbsXmlEnabled({
      enabled: true,
      taxRegime: 'simples_nacional',
      at: new Date('2026-08-19'),
    })).toBe(true)
  })

  it('turns Simples on from 2027 and regime normal by default', () => {
    expect(isIbscbsXmlEnabled({
      taxRegime: 'simples_nacional',
      at: new Date('2027-01-04'),
    })).toBe(true)
    expect(isIbscbsXmlEnabled({
      taxRegime: 'regime_normal',
      at: new Date('2026-08-19'),
    })).toBe(true)
    expect(isIbscbsXmlEnabled({
      enabled: false,
      taxRegime: 'regime_normal',
    })).toBe(false)
  })
})

describe('fiscalIbscbsCclassTribOrNull', () => {
  it('keeps the last three digits and forces the CST prefix', () => {
    expect(fiscalIbscbsCclassTribOrNull('000', '000001')).toBe('000001')
    expect(fiscalIbscbsCclassTribOrNull('000', '200001')).toBe('000001')
    expect(fiscalIbscbsCclassTribOrNull('200', '200001')).toBe('200001')
    expect(fiscalIbscbsCclassTribOrNull('000', '12')).toBeNull()
  })
})

describe('buildIbscbsItem', () => {
  it('uses 2026 test rates on the item amount', () => {
    const config = resolveIbscbsConfig({
      enabled: true,
      cst: '000',
      cClassTrib: '000001',
      taxRegime: 'simples_nacional',
    })
    if (config.ok === false) throw new Error(config.message)
    const item = buildIbscbsItem({
      config: config.config,
      baseCents: 9500,
      at: new Date('2026-08-19'),
    })
    expect(item).toMatchObject({
      cst: '000',
      cClassTrib: '000001',
      vBc: 95,
      pIbsUf: 0.1,
      vIbsUf: 0.1,
      pIbsMun: 0,
      vIbsMun: 0,
      vIbs: 0.1,
      pCbs: 0.9,
      vCbs: 0.86,
      withGibscbs: true,
    })
  })

  it('omits gIBSCBS values for non-incidence CST', () => {
    const config = resolveIbscbsConfig({
      enabled: true,
      cst: '410',
      cClassTrib: '410001',
      taxRegime: 'simples_nacional',
    })
    if (config.ok === false) throw new Error(config.message)
    const item = buildIbscbsItem({
      config: config.config,
      baseCents: 9500,
      at: new Date('2026-08-19'),
    })
    expect(item.withGibscbs).toBe(false)
    expect(item.vCbs).toBe(0)
  })
})

describe('injectNfceIbscbs', () => {
  it('inserts item and total groups without changing vNF', () => {
    const xml = [
      '<ide><cMunFG>3106200</cMunFG></ide>',
      '<det nItem="1"><imposto><ICMS/><PIS/><COFINS/></imposto></det>',
      '<total><ICMSTot><vNF>95.00</vNF></ICMSTot></total>',
    ].join('')
    const config = resolveIbscbsConfig({
      enabled: true,
      cst: '000',
      cClassTrib: '000001',
    })
    if (config.ok === false) throw new Error(config.message)
    const item = buildIbscbsItem({
      config: config.config,
      baseCents: 9500,
      at: new Date('2026-08-19'),
    })
    const out = injectNfceIbscbs(xml, {
      ibscbsItems: [item],
      ibscbsTot: buildIbscbsTot([item], 95),
    })
    expect(out).toContain('<IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib><gIBSCBS>')
    expect(out).toContain('<pIBSUF>0.1000</pIBSUF><vIBSUF>0.10</vIBSUF>')
    expect(out).toContain('<pCBS>0.9000</pCBS><vCBS>0.86</vCBS>')
    expect(out).toContain('<IBSCBSTot><vBCIBSCBS>95.00</vBCIBSCBS>')
    expect(out).toContain('<vNFTot>95.96</vNFTot>')
    expect(out).toContain('<vNF>95.00</vNF></ICMSTot><IBSCBSTot>')
  })
})
