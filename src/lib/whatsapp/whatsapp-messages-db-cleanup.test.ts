import { describe, expect, it } from 'vitest'
import {
  readWhatsappStoragePath,
  resolveWhatsappPurgeStartedAt,
  whatsappMessagePurgeCutoffIso,
} from './whatsapp-messages-db-cleanup'

describe('limpeza de mensagens do WhatsApp', () => {
  const now = new Date('2026-10-09T15:00:00.000Z')

  it('calcula o corte por idade e deixa todas sem corte', () => {
    expect(whatsappMessagePurgeCutoffIso('all', now)).toBeNull()
    expect(whatsappMessagePurgeCutoffIso('30d', now)).toBe('2026-09-09T15:00:00.000Z')
    expect(whatsappMessagePurgeCutoffIso('90d', now)).toBe('2026-07-11T15:00:00.000Z')
  })

  it('recusa data de início no futuro', () => {
    expect(resolveWhatsappPurgeStartedAt('2026-10-09T14:00:00.000Z', now)).toBe('2026-10-09T14:00:00.000Z')
    expect(resolveWhatsappPurgeStartedAt('2099-01-01T00:00:00.000Z', now)).toBe(now.toISOString())
    expect(resolveWhatsappPurgeStartedAt('invalid', now)).toBe(now.toISOString())
  })

  it('lê o caminho de mídia mesmo quando a mídia está marcada como expirada', () => {
    expect(readWhatsappStoragePath({
      media: { storage_path: ' org/file.jpg ', expired: true },
    })).toBe('org/file.jpg')
    expect(readWhatsappStoragePath({ media: { storage_path: '   ' } })).toBeNull()
    expect(readWhatsappStoragePath(null)).toBeNull()
  })
})
