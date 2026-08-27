import { describe, expect, it } from 'vitest'
import { buildSalesCupomHtml, type SalesCupomData } from '@/lib/sales-orders/cupom-print'

function sampleCupom (overrides: Partial<SalesCupomData> = {}): SalesCupomData {
  return {
    orderNumber: 12,
    createdAt: '2026-08-27T12:00:00.000Z',
    customerName: null,
    customerDocument: null,
    subtotalCents: 1000,
    discountTotalCents: 0,
    surchargeCents: 0,
    totalCents: 1000,
    paidAmountCents: 1000,
    changeCents: 0,
    items: [{
      name: 'Película',
      quantity: 1,
      unitPriceCents: 1000,
      discountCents: 0,
      subtotalCents: 1000,
    }],
    payments: [{ methodLabel: 'PIX', amountCents: 1000 }],
    ...overrides,
  }
}

describe('buildSalesCupomHtml consumer', () => {
  it('omits consumer on a non-fiscal cupom without identification', () => {
    const html = buildSalesCupomHtml(sampleCupom(), null, { autoPrint: false })
    expect(html).not.toContain('Consumidor')
    expect(html).not.toContain('CONSUMIDOR NÃO IDENTIFICADO')
  })

  it('prints name and formatted CPF when the consumer identified', () => {
    const html = buildSalesCupomHtml(sampleCupom({
      customerName: 'Maria Silva',
      customerDocument: '12345678901',
    }), null, { autoPrint: false })
    expect(html).toContain('Maria Silva')
    expect(html).toContain('CPF:')
    expect(html).toContain('123.456.789-01')
    expect(html).not.toContain('12345678901')
  })

  it('prints CONSUMIDOR NÃO IDENTIFICADO on NFC-e without document or name', () => {
    const html = buildSalesCupomHtml(sampleCupom({
      customerName: 'Consumidor Final',
      fiscal: {
        title: 'DANFE NFC-e - Nota Fiscal de Consumidor Eletrônica',
        accessKey: null,
        protocol: null,
        qrCodeUrl: null,
        qrCodeDataUrl: null,
        authorizationDate: null,
        environment: 'producao',
      },
    }), null, { autoPrint: false })
    expect(html).toContain('CONSUMIDOR NÃO IDENTIFICADO')
  })

  it('prints formatted CNPJ on NFC-e when identified', () => {
    const html = buildSalesCupomHtml(sampleCupom({
      customerName: 'Loja Exemplo LTDA',
      customerDocument: '12345678000190',
      fiscal: {
        title: 'DANFE NFC-e - Nota Fiscal de Consumidor Eletrônica',
        accessKey: null,
        protocol: null,
        qrCodeUrl: null,
        qrCodeDataUrl: null,
        authorizationDate: null,
        environment: 'producao',
      },
    }), null, { autoPrint: false })
    expect(html).toContain('Loja Exemplo LTDA')
    expect(html).toContain('CNPJ:')
    expect(html).toContain('12.345.678/0001-90')
    expect(html).not.toContain('CONSUMIDOR NÃO IDENTIFICADO')
    expect(html).not.toContain('12345678000190')
  })
})
