import { describe, expect, it } from 'vitest'
import { NFE_XNOME_MAX, clampFiscalCustomerName, nfeXmlText } from '@/lib/fiscal/xml-strings'

describe('nfeXmlText', () => {
  it('truncates dest xNome to 60 chars (SEFAZ schema)', () => {
    const name = 'Hospital Sao Lucas Santa Casa de Misericordia de Belo Horizonte'
    expect(name.length).toBe(63)
    const out = nfeXmlText(name, NFE_XNOME_MAX)
    expect(out.length).toBe(60)
    expect(out).toBe(name.slice(0, 60).trim())
  })

  it('clamps the dest name field to 60 chars', () => {
    expect(clampFiscalCustomerName('a'.repeat(61)).length).toBe(60)
  })

  it('strips control chars and non latin-1 that break the XSD', () => {
    expect(nfeXmlText('Cabo HDMI\ttamanho:5', 120)).toBe('Cabo HDMI tamanho:5')
    expect(nfeXmlText('Loja – Centro', 60)).toBe('Loja Centro')
  })
})
