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
    // Em preparação: só com etiqueta já imprimível.
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'preparing',
      ml_logistic_type: 'drop_off',
      ml_shipment_substatus: 'ready_to_print',
    }, 'preparing')).toBe(true)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'preparing',
      ml_logistic_type: 'drop_off',
      ml_shipment_substatus: 'buffered',
    }, 'preparing')).toBe(false)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'preparing',
      ml_logistic_type: 'drop_off',
      ml_shipment_substatus: null,
    }, 'preparing')).toBe(false)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'pending_shipment',
      ml_logistic_type: 'drop_off',
      ml_shipment_substatus: 'printed',
    }, 'preparing')).toBe(false)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'preparing',
      ml_logistic_type: 'fulfillment',
      ml_shipment_substatus: 'ready_to_print',
    }, 'preparing')).toBe(false)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'shipped',
      ml_logistic_type: null,
    }, 'preparing')).toBe(false)
    // Envios pendentes: não enviadas (com ou sem etiqueta), exceto FULL.
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'preparing',
      ml_logistic_type: null,
    }, 'pending_shipment')).toBe(true)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'pending_shipment',
      ml_logistic_type: 'self_service',
    }, 'pending_shipment')).toBe(true)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'pending_shipment',
      ml_logistic_type: 'fulfillment',
    }, 'pending_shipment')).toBe(false)
    expect(orderMatchesSalesLane({
      ml_fulfillment_stage: 'shipped',
      ml_logistic_type: null,
    }, 'pending_shipment')).toBe(false)
  })

  it('reconhece Flex pelo tipo logístico ou pela tag', () => {
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
    }, 'flex')).toBe(true)
  })
})
