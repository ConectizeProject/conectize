import { describe, expect, it } from 'vitest'
import { parseInboundNfeXml, readInboundXmlUpload } from '@/lib/fiscal/parse-inbound-nfe-xml'

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe35240112345678000190550010000001231000001234">
      <ide>
        <serie>1</serie>
        <nNF>123</nNF>
        <dhEmi>2024-01-15T10:30:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000190</CNPJ>
        <xNome>Fornecedor Exemplo LTDA</xNome>
      </emit>
      <dest>
        <CNPJ>99888777000166</CNPJ>
        <xNome>Loja Destino</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>SKU-1</cProd>
          <cEAN>7891234567890</cEAN>
          <xProd>Cabo USB-C</xProd>
          <NCM>85444200</NCM>
          <uCom>UN</uCom>
          <qCom>2.0000</qCom>
          <vUnCom>15.50</vUnCom>
          <vProd>31.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vNF>31.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`

describe('parseInboundNfeXml', () => {
  it('extrai chave, emitente e itens', () => {
    const result = parseInboundNfeXml(SAMPLE_XML)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.accessKey).toBe('35240112345678000190550010000001231000001234')
    expect(result.document.series).toBe(1)
    expect(result.document.number).toBe(123)
    expect(result.document.issuerName).toBe('Fornecedor Exemplo LTDA')
    expect(result.document.totalCents).toBe(3100)
    expect(result.document.items).toHaveLength(1)
    expect(result.document.items[0]).toMatchObject({
      productCode: 'SKU-1',
      barcode: '7891234567890',
      description: 'Cabo USB-C',
      quantity: 2,
      unitValueCents: 1550,
      totalCents: 3100,
    })
  })

  it('rejeita xml vazio', () => {
    const result = parseInboundNfeXml('')
    expect(result.ok).toBe(false)
  })

  it('lê NF-e com imposto, dois itens e detPag', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe><infNFe Id="NFe35240112345678000190550010000001231000001234" versao="4.00">
    <ide><serie>1</serie><nNF>123</nNF><dhEmi>2024-01-15T10:30:00-03:00</dhEmi></ide>
    <emit><CNPJ>12345678000190</CNPJ><xNome>Fornecedor</xNome></emit>
    <dest><CNPJ>99888777000166</CNPJ><xNome>Loja</xNome></dest>
    <det nItem="1"><prod><cProd>A1</cProd><cEAN>SEM GTIN</cEAN><xProd>Tela</xProd><NCM>85171231</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>1.0000</qCom><vUnCom>10.0000000000</vUnCom><vProd>10.00</vProd></prod><imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS></imposto></det>
    <det nItem="2"><prod><cProd>B2</cProd><xProd>Cabo</xProd><NCM>85444200</NCM><qCom>2.0000</qCom><vUnCom>5.50</vUnCom><vProd>11.00</vProd></prod></det>
    <total><ICMSTot><vNF>21.00</vNF></ICMSTot></total>
    <pag><detPag><tPag>01</tPag><vPag>21.00</vPag></detPag></pag>
  </infNFe></NFe>
</nfeProc>`
    const result = parseInboundNfeXml(xml)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.items).toHaveLength(2)
    expect(result.document.items[0]?.description).toBe('Tela')
    expect(result.document.items[1]?.quantity).toBe(2)
    expect(result.document.totalCents).toBe(2100)
  })

  it('aceita XML escapado e rejeita ZIP', () => {
    const escaped = '&lt;nfeProc&gt;&lt;NFe&gt;&lt;infNFe Id="NFe35240112345678000190550010000001231000001234"&gt;&lt;ide&gt;&lt;serie&gt;1&lt;/serie&gt;&lt;nNF&gt;9&lt;/nNF&gt;&lt;/ide&gt;&lt;det nItem="1"&gt;&lt;prod&gt;&lt;xProd&gt;Peca&lt;/xProd&gt;&lt;qCom&gt;1.0000&lt;/qCom&gt;&lt;vUnCom&gt;3.00&lt;/vUnCom&gt;&lt;vProd&gt;3.00&lt;/vProd&gt;&lt;/prod&gt;&lt;/det&gt;&lt;/infNFe&gt;&lt;/NFe&gt;&lt;/nfeProc&gt;'
    const parsed = parseInboundNfeXml(escaped)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.document.number).toBe(9)

    const zip = readInboundXmlUpload(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00]))
    expect(zip.ok).toBe(false)
  })
})
