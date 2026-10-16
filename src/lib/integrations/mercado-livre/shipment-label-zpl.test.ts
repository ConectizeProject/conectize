import { describe, expect, it } from 'vitest'
import { zipSync } from 'fflate'
import {
  buildCustomizedShipmentLabelZpl,
  extractZplFromShipmentLabelsZip,
  findResidencialBand,
  findSkuVerticalBand,
  formatNfFooterText,
  formatSkuLabelText,
  injectNfFooter,
  injectSkuOnLeft,
  labelSizeInchesFromZpl,
} from '@/lib/integrations/mercado-livre/shipment-label-zpl'

describe('shipment label zpl', () => {
  it('formata SKUs com quantidade', () => {
    expect(formatSkuLabelText([
      { sku: 'TMDADPTMKB', quantity: 1 },
    ])).toBe('SKUs: TMDADPTMKB')

    expect(formatSkuLabelText([
      { sku: 'TMDADPTMKB', quantity: 2 },
    ])).toBe('SKUs: 2 x TMDADPTMKB')

    expect(formatSkuLabelText([
      { sku: 'AAA', quantity: 2 },
      { sku: 'BBB', quantity: 1 },
    ])).toBe('SKUs: 2 x AAA; BBB')

    expect(formatSkuLabelText([
      { sku: null, quantity: 1 },
      { sku: '  ', quantity: 3 },
    ])).toBeNull()
  })

  it('formata rodapé de NF-e simplificado', () => {
    expect(formatNfFooterText({
      series: 1,
      number: 952,
      accessKey: '31261012345678000190550010000009521234567890',
    })).toBe('NF-e Série 1 · Nº 952 · 34567890')

    expect(formatNfFooterText({})).toBeNull()
  })

  it('injeta SKU à esquerda antes do ^XZ', () => {
    const base = '^XA\n^PW812\n^LL1218\n^FO10,10^FDORIG^FS\n^XZ\n'
    const next = injectSkuOnLeft(base, 'SKUs: TMDADPTMKB')
    expect(next).toContain('^A0B,')
    expect(next).toMatch(/\^FO\d+,\d+\^A0B,/)
    expect(next).toContain('^FDSKUs: TMDADPTMKB^FS')
    expect(next.trimEnd().endsWith('^XZ')).toBe(true)
    expect(next.indexOf('SKUs: TMDADPTMKB')).toBeLessThan(next.toUpperCase().indexOf('^XZ'))
  })

  it('injeta SKU na 1ª etiqueta quando o ZPL MELI tem várias páginas', () => {
    const multi = [
      '^XA',
      '^LH5,15',
      '^FO250,275^BY4,4,0^BQN,2,7^FDLA,test^FS',
      '^FO40,845^A0N,28,28^FDEndereco^FS',
      '^XZ',
      '^XA^MCY^XZ^XA',
      '^FO40,1020^A0N,25,25^FDDADOS ADICIONAIS^FS',
      '^FO40,1050^A0N,20,20^FB740,8,3,L^FH^FD^FS',
      '^XZ',
      '',
    ].join('\n')
    const next = injectSkuOnLeft(multi, 'SKUs: TMDADPTMKB')
    const firstXz = next.toUpperCase().indexOf('^XZ')
    const skuPos = next.indexOf('^FDSKUs: TMDADPTMKB^FS')
    expect(skuPos).toBeGreaterThan(-1)
    expect(skuPos).toBeLessThan(firstXz)
    expect(next).toContain('^FH^FDSKUs: TMDADPTMKB^FS')
  })

  it('centraliza o SKU no miolo (Envio Flex → linha acima de RESIDENCIAL) mantendo X à esquerda', () => {
    const base = [
      '^XA',
      '^FO0,245^GB800,0,2^FS',
      '^FO250,275^BY4,4,0^BQN,2,7^FDLA,test^FS',
      '^FO0,755^GB800,0,2^FS',
      '^FO0,770^A0N,48,48^FB800,1,0,C^FH^FDRESIDENCIAL^FS',
      '^FO0,820^GB800,0,2^FS',
      '^XZ',
      '',
    ].join('\n')
    expect(findResidencialBand(base)).toEqual({ top: 755, bottom: 820 })
    expect(findSkuVerticalBand(base)).toEqual({ top: 245, bottom: 755 })
    const next = injectSkuOnLeft(base, 'SKUs: TMDADPTMKB')
    const match = next.match(/\^FO(\d+),(\d+)\^A0B,32,26\^FDSKUs: TMDADPTMKB\^FS/)
    expect(match).toBeTruthy()
    expect(Number(match?.[1])).toBe(12)
    // ^A0B cresce para cima: FO.y = centro do miolo + len/2 (advance 0.5 * width)
    const textLen = 'SKUs: TMDADPTMKB'.length * Math.round(26 * 0.5)
    expect(Number(match?.[2])).toBe(Math.round((245 + 755) / 2 + textLen / 2))
  })

  it('injeta NF no rodapé', () => {
    const base = '^XA\n^PW812\n^LL1218\n^XZ\n'
    const next = injectNfFooter(base, 'NF-e Série 1 · Nº 952')
    expect(next).toContain('^A0N,')
    expect(next).toContain('NF-e Série 1')
    expect(next.trimEnd().endsWith('^XZ')).toBe(true)
  })

  it('extrai ZPL de um ZIP e customiza Flex só com SKU', () => {
    const zpl = '^XA\n^PW812\n^LL1218\n^FO20,20^FDME^FS\n^XZ\n'
    const zipBytes = zipSync({
      'label.txt': new TextEncoder().encode(zpl),
      'summary.pdf': new TextEncoder().encode('%PDF-1.4'),
    })

    expect(extractZplFromShipmentLabelsZip(zipBytes)).toContain('^XA')

    const customized = buildCustomizedShipmentLabelZpl({
      zipBytes,
      items: [{ sku: 'TMDADPTMKB', quantity: 2 }],
      isFlex: true,
      nf: { series: 1, number: 10, accessKey: '12345678' },
    })
    expect(customized).toContain('SKUs: 2 x TMDADPTMKB')
    expect(customized).not.toContain('NF-e')
  })

  it('calcula tamanho da etiqueta em polegadas a partir do ZPL', () => {
    expect(labelSizeInchesFromZpl('^XA^PW812^LL1218^XZ')).toEqual({
      width: 4,
      height: 6,
    })
  })

  it('em não-Flex inclui SKU e NF', () => {
    const zpl = '^XA\n^PW812\n^LL1218\n^XZ\n'
    const zipBytes = zipSync({
      'envio.zpl': new TextEncoder().encode(zpl),
    })
    const customized = buildCustomizedShipmentLabelZpl({
      zipBytes,
      items: [{ sku: 'ABC', quantity: 1 }],
      isFlex: false,
      nf: { series: 1, number: 99, accessKey: 'ABCDEFGH12345678' },
    })
    expect(customized).toContain('SKUs: ABC')
    expect(customized).toContain('NF-e Série 1 · Nº 99')
    expect(customized).toContain('12345678')
  })
})
