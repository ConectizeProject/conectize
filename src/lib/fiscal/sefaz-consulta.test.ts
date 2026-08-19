import { describe, expect, it } from 'vitest'
import {
  asDownloadableNfceXml,
  asSignedNfceXml,
  buildNfeProcXml,
  classifyConsultaStatus,
  extractAccessKeyFromXml,
  extractNfeXmlFromSoap,
  isDuplicateSefazError,
  isUncertainSefazError,
  nfceXmlFilename,
  parseNfceConsultaXml,
} from '@/lib/fiscal/sefaz-consulta'

describe('classifyConsultaStatus', () => {
  it('maps SEFAZ situation codes', () => {
    expect(classifyConsultaStatus('100')).toBe('authorized')
    expect(classifyConsultaStatus('101')).toBe('canceled')
    expect(classifyConsultaStatus('110')).toBe('denied')
    expect(classifyConsultaStatus('217')).toBe('not_found')
    expect(classifyConsultaStatus('539')).toBe('other')
  })
})

describe('parseNfceConsultaXml', () => {
  it('reads authorized protocol from retConsSitNFe', () => {
    const xml = `
      <retConsSitNFe versao="4.00">
        <cStat>100</cStat>
        <xMotivo>Autorizado o uso da NF-e</xMotivo>
        <protNFe versao="4.00">
          <infProt>
            <cStat>100</cStat>
            <nProt>131260000012345</nProt>
            <chNFe>31260812345678000155650020000000011000000010</chNFe>
            <dhRecbto>2026-08-18T21:00:00-03:00</dhRecbto>
          </infProt>
        </protNFe>
      </retConsSitNFe>
    `
    const parsed = parseNfceConsultaXml(xml)
    expect(parsed.kind).toBe('authorized')
    expect(parsed.statusCode).toBe('100')
    expect(parsed.protocol).toBe('131260000012345')
    expect(parsed.protNfeXml).toContain('131260000012345')
  })

  it('reads not found without treating protNFe as missing', () => {
    const xml = `
      <retConsSitNFe>
        <cStat>217</cStat>
        <xMotivo>Rejeicao: NF-e inexistente</xMotivo>
      </retConsSitNFe>
    `
    const parsed = parseNfceConsultaXml(xml)
    expect(parsed.kind).toBe('not_found')
    expect(parsed.protocol).toBe(null)
  })
})

describe('access key helpers', () => {
  it('extracts chave from infNFe Id', () => {
    expect(extractAccessKeyFromXml('<infNFe Id="NFe31260812345678000155650020000000011000000010">'))
      .toBe('31260812345678000155650020000000011000000010')
  })

  it('extracts NFe from SOAP envelope', () => {
    const xml = '<soap:Body><enviNFe><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe1"/></NFe></enviNFe></soap:Body>'
    expect(extractNfeXmlFromSoap(xml)).toContain('<infNFe Id="NFe1"/>')
  })

  it('builds nfeProc from signed xml and protocol', () => {
    const proc = buildNfeProcXml('<NFe>signed</NFe>', '<protNFe>ok</protNFe>')
    expect(proc).toContain('<nfeProc versao="4.00"')
    expect(proc).toContain('<NFe>signed</NFe>')
    expect(proc).toContain('<protNFe>ok</protNFe>')
  })

  it('ignores the old JSON placeholder', () => {
    expect(asSignedNfceXml('{"model":"65","orderId":"x"}')).toBe(null)
    expect(asSignedNfceXml('<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe/></NFe>'))
      .toContain('<infNFe/>')
  })

  it('prefers nfeProc for download', () => {
    const xml = asDownloadableNfceXml(
      '<?xml version="1.0"?><nfeProc versao="4.00"><NFe><infNFe/></NFe><protNFe/></nfeProc>',
    )
    expect(xml).toContain('<nfeProc versao="4.00">')
    expect(xml).toContain('<protNFe/>')
  })

  it('falls back to signed NFe and ignores JSON', () => {
    expect(asDownloadableNfceXml('{"model":"65"}')).toBe(null)
    expect(asDownloadableNfceXml('<NFe><infNFe Id="NFe1"/></NFe>')).toMatch(/^<\?xml/)
  })

  it('names the file with the 44-digit access key', () => {
    expect(nfceXmlFilename('31260812345678000155650020000000011000000010'))
      .toBe('31260812345678000155650020000000011000000010.xml')
    expect(nfceXmlFilename(null, 1, 12)).toBe('NFCe-1-000000012.xml')
  })
})

describe('uncertain / duplicate errors', () => {
  it('detects timeout and reset', () => {
    expect(isUncertainSefazError(new Error('Timeout ao comunicar com SEFAZ'))).toBe(true)
    expect(isUncertainSefazError(new Error('read ECONNRESET'))).toBe(true)
    expect(isUncertainSefazError(new Error('Schema invalid'))).toBe(false)
  })

  it('detects cStat 204', () => {
    expect(isDuplicateSefazError({ cStat: '204', xMotivo: 'Duplicidade' })).toBe(true)
    expect(isDuplicateSefazError({ cStat: '539' })).toBe(false)
  })
})
