import { describe, expect, it } from 'vitest'
import { parseEvolutionMessageStatusUpdates } from '@/lib/whatsapp/parse-evolution-message-status'
import {
  isWaDeliveryStatusUpgrade,
  normalizeWaDeliveryStatus,
  resolveOutboundDeliveryStatus,
} from '@/lib/whatsapp/whatsapp-message-delivery-status'

describe('normalizeWaDeliveryStatus', () => {
  it('mapeia strings da Evolution', () => {
    expect(normalizeWaDeliveryStatus('SERVER_ACK')).toBe('sent')
    expect(normalizeWaDeliveryStatus('DELIVERY_ACK')).toBe('delivered')
    expect(normalizeWaDeliveryStatus('READ')).toBe('read')
    expect(normalizeWaDeliveryStatus('PLAYED')).toBe('played')
  })

  it('mapeia numeros do Baileys', () => {
    expect(normalizeWaDeliveryStatus(3)).toBe('delivered')
    expect(normalizeWaDeliveryStatus(4)).toBe('read')
  })
})

describe('isWaDeliveryStatusUpgrade', () => {
  it('nao regride de read para delivered', () => {
    expect(isWaDeliveryStatusUpgrade('read', 'delivered')).toBe(false)
    expect(isWaDeliveryStatusUpgrade('sent', 'read')).toBe(true)
  })
})

describe('parseEvolutionMessageStatusUpdates', () => {
  it('parseia MESSAGES_UPDATE com keyId e status', () => {
    const list = parseEvolutionMessageStatusUpdates({
      instance: 'Victor',
      data: {
        keyId: 'ABC123',
        fromMe: true,
        status: 'READ',
      },
    })
    expect(list).toHaveLength(1)
    expect(list[0].stableWaMessageId).toBe('Victor:ABC123')
    expect(list[0].deliveryStatus).toBe('read')
  })
})

describe('resolveOutboundDeliveryStatus', () => {
  it('default sent', () => {
    expect(resolveOutboundDeliveryStatus({})).toBe('sent')
    expect(resolveOutboundDeliveryStatus({ delivery_status: 'delivered' })).toBe('delivered')
  })
})
