import { gzipSync } from 'zlib'
import { describe, expect, it } from 'vitest'
import {
  buildNfeDistDFeEnvelope,
  NFE_UF_IBGE,
  parseNfeDistDFeResponse,
} from '@/lib/fiscal/nfe-dist-dfe'

const ACCESS_KEY = '35240112345678000195550010000001231000000011'

function docZip (xml: string) {
  return gzipSync(Buffer.from(xml, 'utf8')).toString('base64')
}

describe('nfe dist dfe', () => {
  it('monta a consulta pela chave com a UF da loja', () => {
    expect(NFE_UF_IBGE.MG).toBe('31')
    const envelope = buildNfeDistDFeEnvelope({
      environment: 'producao',
      ufCode: '31',
      cnpj: '12345678000195',
      accessKey: ACCESS_KEY,
    })
    expect(envelope).toContain('<tpAmb>1</tpAmb>')
    expect(envelope).toContain('<cUFAutor>31</cUFAutor>')
    expect(envelope).toContain(`<chNFe>${ACCESS_KEY}</chNFe>`)
    expect(envelope).toContain('<CNPJ>12345678000195</CNPJ>')
  })

  it('descompacta o XML completo da nota', () => {
    const xml = `<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe${ACCESS_KEY}"></infNFe></NFe></nfeProc>`
    const soap = `<retDistDFeInt><tpAmb>1</tpAmb><cStat>138</cStat><xMotivo>Documento localizado</xMotivo><loteDistDFeInt><docZip schema="procNFe_v4.00.xsd">${docZip(xml)}</docZip></loteDistDFeInt></retDistDFeInt>`
    const parsed = parseNfeDistDFeResponse(soap)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.xml).toContain(`Id="NFe${ACCESS_KEY}"`)
  })

  it('recusa o resumo sem os itens', () => {
    const xml = '<resNFe><chNFe>35240112345678000195550010000001231000000011</chNFe></resNFe>'
    const soap = `<retDistDFeInt><cStat>138</cStat><xMotivo>Documento localizado</xMotivo><loteDistDFeInt><docZip schema="resNFe_v1.01.xsd">${docZip(xml)}</docZip></loteDistDFeInt></retDistDFeInt>`
    const parsed = parseNfeDistDFeResponse(soap)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toBe('summary_only')
  })

  it('explica quando a SEFAZ não localiza a nota', () => {
    const parsed = parseNfeDistDFeResponse('<retDistDFeInt><cStat>137</cStat><xMotivo>Nenhum documento localizado</xMotivo></retDistDFeInt>')
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.error).toBe('not_found')
      expect(parsed.message).toContain('CNPJ da loja')
    }
  })
})
