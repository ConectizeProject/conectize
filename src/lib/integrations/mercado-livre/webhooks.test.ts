import { describe, expect, it } from 'vitest'
import {
  isMeliShipmentsTopic,
  parseMeliWebhook,
} from '@/lib/integrations/mercado-livre/webhooks'

describe('meli webhook', () => {
  it('lê o envio notificado pelo Mercado Livre', () => {
    const parsed = parseMeliWebhook({
      topic: 'shipments',
      resource: '/shipments/441122',
      user_id: 99,
    })
    expect(isMeliShipmentsTopic(parsed.topic)).toBe(true)
    expect(parsed.shipmentId).toBe('441122')
    expect(parsed.orderId).toBeNull()
  })

  it('lê o pedido notificado pelo Mercado Livre', () => {
    const parsed = parseMeliWebhook({
      topic: 'orders_v2',
      resource: '/orders/550011',
      user_id: 99,
    })
    expect(parsed.orderId).toBe('550011')
    expect(parsed.shipmentId).toBeNull()
  })
})
