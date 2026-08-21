import { describe, expect, it } from 'vitest'
import { parseInboundNfeXml } from '@/lib/fiscal/parse-inbound-nfe-xml'

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
})
