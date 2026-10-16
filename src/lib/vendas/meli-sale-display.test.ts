import { describe, expect, it } from 'vitest'
import {
  meliLabelStatus,
  meliSaleDisplayFromPayloads,
  saleExitAt,
  saleProfitBreakdown,
  stockAfterSale,
  taxCentsFromMargin,
} from '@/lib/vendas/meli-sale-display'

describe('meli sale display', () => {
  it('lê frete, reembolso, comprador e limite de postagem', () => {
    const display = meliSaleDisplayFromPayloads({
      order: {
        buyer: { first_name: 'Thiago', last_name: 'Silva', nickname: 'TSALESS' },
        order_items: [{ sale_fee: 9.23 }],
      },
      shipment: {
        status: 'ready_to_ship',
        substatus: 'ready_to_print',
        lead_time: {
          estimated_delivery_time: { date: '2026-10-16T00:00:00.000-03:00' },
          shipping_method: { name: 'Prioritario' },
        },
      },
      costs: {
        gross_amount: 7.99,
        senders: [{ cost: 0, compensation: 0 }],
        receiver: { cost: 0, save: 0 },
      },
      sla: { expected_date: '2026-10-16T23:00:00-03:00' },
    })

    expect(display.buyerName).toBe('Thiago Silva')
    expect(display.buyerNickname).toBe('TSALESS')
    expect(display.shippingGrossCents).toBe(799)
    expect(display.shippingRefundCents).toBe(799)
    expect(display.saleFeeCents).toBe(923)
    expect(display.postingDeadline).toBe('2026-10-16T23:00:00-03:00')
    expect(display.deliveryEstimate).toBe('2026-10-16T00:00:00.000-03:00')
    expect(display.shippingMethodName).toBe('Prioritario')
    expect(display.labelStatus).toBe('Etiqueta aguardando impressão')
    expect(display.items).toEqual([])
  })

  it('usa o custo do vendedor no FULL sem inventar reembolso via receiver.save', () => {
    const display = meliSaleDisplayFromPayloads({
      order: { order_items: [{ sale_fee: 4.12 }] },
      shipment: null,
      costs: {
        gross_amount: 10.56,
        receiver: { cost: 0, save: 0.77 },
        senders: [{ cost: 6.85, compensation: 0, save: 0 }],
      },
      sla: null,
    })
    expect(display.shippingGrossCents).toBe(685)
    expect(display.shippingRefundCents).toBeNull()
    expect(display.saleFeeCents).toBe(412)
  })

  it('multiplica sale_fee pela quantidade do item', () => {
    const display = meliSaleDisplayFromPayloads({
      order: { order_items: [{ sale_fee: 2.6, quantity: 2 }] },
      shipment: null,
      costs: null,
      sla: null,
    })
    expect(display.saleFeeCents).toBe(520)
  })

  it('lê a data de disponibilidade da etiqueta no buffering', () => {
    const display = meliSaleDisplayFromPayloads({
      order: null,
      shipment: {
        status: 'pending',
        substatus: 'buffered',
        lead_time: {
          buffering: { date: '2026-10-22T00:00:00.000-03:00' },
          shipping_method: { name: 'Normal ao endereço' },
        },
      },
      costs: null,
      sla: null,
    })
    expect(display.labelPrintable).toBe(false)
    expect(display.labelAvailableAt).toBe('2026-10-22T00:00:00.000-03:00')
    expect(display.labelStatus).toBe('Etiqueta agendada')
  })

  it('usa criação + shipping quando buffering cai no prazo final', () => {
    const display = meliSaleDisplayFromPayloads({
      order: null,
      shipment: {
        status: 'pending',
        substatus: 'buffered',
        date_created: '2026-10-16T10:36:39.340-04:00',
        lead_time: {
          buffering: { date: '2026-10-22T00:00:00.000Z' },
          estimated_delivery_time: { shipping: 96, handling: 0 },
        },
      },
      costs: null,
      sla: null,
    })
    expect(display.labelPrintable).toBe(false)
    // 16/10 10:36-04 + 96h = 20/10 10:36-04
    expect(display.labelAvailableAt).toBe('2026-10-20T14:36:39.340Z')
  })

  it('mantém fallback legado com gross_amount e receiver.save', () => {
    const display = meliSaleDisplayFromPayloads({
      order: null,
      shipment: null,
      costs: {
        gross_amount: 7.99,
        receiver: { save: 7.99 },
      },
      sla: null,
    })
    expect(display.shippingGrossCents).toBe(799)
    expect(display.shippingRefundCents).toBe(799)
  })

  it('lê o anúncio MLB do item vendido', () => {
    const display = meliSaleDisplayFromPayloads({
      order: {
        order_items: [{
          item: {
            id: 'mlb998877',
            title: 'Plug Tomada',
            seller_sku: 'TMDADPTMKB',
          },
        }],
      },
      shipment: null,
      costs: null,
      sla: null,
    })
    expect(display.items).toEqual([{
      itemId: 'MLB998877',
      sku: 'TMDADPTMKB',
      title: 'Plug Tomada',
      url: 'https://produto.mercadolivre.com.br/MLB-998877',
    }])
  })

  it('calcula imposto de 9,5% sobre a venda', () => {
    expect(taxCentsFromMargin(2246, 9.5)).toBe(213)
    expect(meliLabelStatus('ready_to_ship', 'printed')).toBe('Etiqueta impressa')
  })

  it('separa lucro bruto e lucro líquido', () => {
    expect(saleProfitBreakdown({
      saleCents: 2246,
      freightCents: 799,
      refundCents: 799,
      feeCents: 923,
      productCostCents: 500,
      taxCents: 213,
    })).toEqual({
      saleCents: 2246,
      freightCents: 799,
      refundCents: 799,
      feeCents: 923,
      grossCents: 1323,
      productCostCents: 500,
      taxCents: 213,
      netCents: 610,
    })
  })

  it('calcula o saldo depois da baixa desta venda', () => {
    const movements = [
      {
        productId: 'p1',
        salesOrderId: 'o1',
        type: 'exit',
        quantity: 1,
        createdAt: '2026-10-15T15:16:00.000Z',
      },
      {
        productId: 'p1',
        salesOrderId: 'o2',
        type: 'exit',
        quantity: 2,
        createdAt: '2026-10-15T16:00:00.000Z',
      },
    ]
    expect(saleExitAt(movements, 'o1', 'p1')).toBe('2026-10-15T15:16:00.000Z')
    expect(stockAfterSale({
      currentStock: 97,
      saleAt: saleExitAt(movements, 'o1', 'p1'),
      movements,
      productId: 'p1',
    })).toBe(99)
  })
})
