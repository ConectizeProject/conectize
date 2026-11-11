import { describe, expect, it } from 'vitest'
import {
  meliFulfillmentStage,
  meliLogisticType,
  meliLogisticTypeFromShipment,
  orderMatchesSalesLane,
  parseMarketplaceOrderNumber,
  parseSalesLane,
} from '@/lib/vendas/sales-lane'

describe('sales lane', () => {
  it('aceita só as etapas do cabeçalho', () => {
    expect(parseSalesLane('preparing')).toBe('preparing')
    expect(parseSalesLane('pagamento')).toBeNull()
    expect(parseSalesLane('')).toBeNull()
  })

  it('separa nota pendente, etiqueta emitida e envio', () => {
    expect(meliFulfillmentStage({
      shipmentStatus: null,
      shipmentSubstatus: null,
    })).toBe('preparing')
    expect(meliFulfillmentStage({
      shipmentStatus: 'ready_to_ship',
      shipmentSubstatus: 'invoice_pending',
    })).toBe('preparing')
    expect(meliFulfillmentStage({
      shipmentStatus: 'ready_to_ship',
      shipmentSubstatus: 'ready_to_print',
    })).toBe('preparing')
    expect(meliFulfillmentStage({
      shipmentStatus: 'ready_to_ship',
      shipmentSubstatus: 'printed',
    })).toBe('pending_shipment')
    expect(meliFulfillmentStage({
      shipmentStatus: 'ready_to_ship',
      shipmentSubstatus: 'dropped_off',
    })).toBe('shipped')
    expect(meliFulfillmentStage({
      shipmentStatus: 'ready_to_ship',
      shipmentSubstatus: 'picked_up',
    })).toBe('shipped')
    expect(meliFulfillmentStage({
      shipmentStatus: 'shipped',
      shipmentSubstatus: 'dropped_off',
    })).toBe('shipped')
    expect(meliFulfillmentStage({
      shipmentStatus: 'cancelled',
      shipmentSubstatus: null,
    })).toBeNull()
  })

  it('filtra o número do marketplace e as etapas dos menus', () => {
    expect(parseMarketplaceOrderNumber('ML 2000018995039116')).toBe('2000018995039116')
    // Em preparação / envios de hoje: liberação da etiqueta <= hoje.
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'preparing',
      ml_logistic_type: 'drop_off',
      ml_shipment_substatus: 'ready_to_print',
      ml_label_available_at: '2026-10-16T12:00:00.000Z',
    }, 'preparing', '2026-10-16')).toBe(true)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'pending_shipment',
      ml_logistic_type: 'drop_off',
      ml_shipment_substatus: 'printed',
      ml_label_available_at: '2026-10-16T10:00:00.000Z',
    }, 'preparing', '2026-10-16')).toBe(true)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'preparing',
      ml_logistic_type: 'drop_off',
      ml_shipment_substatus: 'buffered',
      ml_label_available_at: '2026-10-18T12:00:00.000Z',
    }, 'preparing', '2026-10-16')).toBe(false)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'preparing',
      ml_logistic_type: 'self_service',
      ml_shipment_substatus: 'ready_to_print',
      ml_label_available_at: '2026-10-16T12:00:00.000Z',
    }, 'preparing', '2026-10-16')).toBe(false)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'preparing',
      ml_logistic_type: 'fulfillment',
      ml_shipment_substatus: 'ready_to_print',
      ml_label_available_at: '2026-10-16T12:00:00.000Z',
    }, 'preparing', '2026-10-16')).toBe(false)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'shipped',
      ml_logistic_type: null,
    }, 'preparing', '2026-10-16')).toBe(false)
    // Envios pendentes / próximos dias: buffered ou data futura.
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'preparing',
      ml_logistic_type: null,
      ml_shipment_substatus: 'buffered',
      ml_label_available_at: '2026-10-18T12:00:00.000Z',
    }, 'pending_shipment', '2026-10-16')).toBe(true)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'pending_shipment',
      ml_logistic_type: 'self_service',
      ml_shipment_substatus: 'ready_to_print',
      ml_label_available_at: '2026-10-20T12:00:00.000Z',
    }, 'pending_shipment', '2026-10-16')).toBe(true)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'pending_shipment',
      ml_logistic_type: 'drop_off',
      ml_shipment_substatus: 'printed',
      ml_label_available_at: '2026-10-16T10:00:00.000Z',
    }, 'pending_shipment', '2026-10-16')).toBe(false)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'pending_shipment',
      ml_logistic_type: 'fulfillment',
      ml_label_available_at: '2026-10-20T12:00:00.000Z',
    }, 'pending_shipment', '2026-10-16')).toBe(false)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'shipped',
      ml_logistic_type: null,
    }, 'pending_shipment', '2026-10-16')).toBe(false)
    // Sem data de liberação: usa prazo de postagem; se também não houver, conta como hoje.
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'preparing',
      ml_logistic_type: 'self_service',
      ml_shipment_substatus: 'ready_to_print',
      ml_label_available_at: null,
      ml_posting_deadline: '2026-10-16T21:00:00-03:00',
    }, 'pending_shipment', '2026-10-16')).toBe(false)
  })

  it('reconhece Flex pelo tipo logístico, tag ou método Prioritario', () => {
    expect(meliLogisticType({ logisticType: 'self_service' })).toBe('self_service')
    expect(meliLogisticType({
      logisticType: null,
      tags: ['self_service_in'],
    })).toBe('self_service')
    expect(meliLogisticType({ logisticType: 'drop_off', tags: [] })).toBe('drop_off')
    expect(meliLogisticTypeFromShipment({
      shipment: { logistic: { mode: 'me2', type: 'self_service' } },
      shipping: { id: 1 },
      tags: ['paid'],
    })).toBe('self_service')
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'preparing',
      ml_logistic_type: 'self_service',
      ml_shipment_substatus: 'ready_to_print',
      ml_label_available_at: '2026-10-16T12:00:00.000Z',
    }, 'flex', '2026-10-16')).toBe(true)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'preparing',
      ml_logistic_type: null,
      ml_shipping_method: 'Prioritario',
      ml_shipment_substatus: 'ready_to_print',
      ml_posting_deadline: '2026-10-16T21:00:00-03:00',
    }, 'flex', '2026-10-16')).toBe(true)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'preparing',
      ml_logistic_type: 'self_service',
      ml_shipment_substatus: 'buffered',
      ml_label_available_at: '2026-10-20T12:00:00.000Z',
    }, 'flex', '2026-10-16')).toBe(false)
  })

  it('dont_ship lista só cancelada MELI do dia e ignora FULL', () => {
    expect(orderMatchesSalesLane({
      status: 'canceled',
      ml_order_id: '2000019474516120',
      ml_logistic_type: 'self_service',
      ml_shipment_status: 'cancelled',
      ml_posting_deadline: '2026-10-16T23:00:00-03:00',
    }, 'dont_ship', '2026-10-16')).toBe(true)
    expect(orderMatchesSalesLane({
      status: 'canceled',
      ml_order_id: 'full-1',
      ml_logistic_type: 'fulfillment',
      ml_shipment_status: 'cancelled',
      ml_posting_deadline: '2026-10-16T23:00:00-03:00',
    }, 'dont_ship', '2026-10-16')).toBe(false)
    expect(orderMatchesSalesLane({
      status: 'canceled',
      ml_order_id: 'old-1',
      ml_logistic_type: 'self_service',
      ml_shipment_status: 'cancelled',
      ml_posting_deadline: null,
      ml_label_available_at: null,
    }, 'dont_ship', '2026-10-16')).toBe(false)
    expect(orderMatchesSalesLane({
      status: 'canceled',
      ml_order_id: 'old-2',
      ml_logistic_type: 'drop_off',
      ml_shipment_status: 'cancelled',
      ml_posting_deadline: '2026-10-10T13:00:00-03:00',
    }, 'dont_ship', '2026-10-16')).toBe(false)
  })
})
