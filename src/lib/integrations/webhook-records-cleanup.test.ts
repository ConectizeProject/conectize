import { describe, expect, it } from 'vitest'
import {
  resolveWebhookPurgeStartedAt,
  webhookPurgePlatformQueue,
  webhookRecordPurgeCutoffIso,
} from './webhook-records-cleanup'

describe('limpeza de registros de webhook', () => {
  const now = new Date('2026-10-09T15:00:00.000Z')

  it('calcula o corte por idade e deixa todos sem corte', () => {
    expect(webhookRecordPurgeCutoffIso('all', now)).toBeNull()
    expect(webhookRecordPurgeCutoffIso('90d', now)).toBe('2026-07-11T15:00:00.000Z')
  })

  it('recusa data de início no futuro', () => {
    expect(resolveWebhookPurgeStartedAt('2026-10-09T14:00:00.000Z', now)).toBe('2026-10-09T14:00:00.000Z')
    expect(resolveWebhookPurgeStartedAt('2099-01-01T00:00:00.000Z', now)).toBe(now.toISOString())
  })

  it('percorre Bling, Mercado Livre e as demais plataformas', () => {
    expect(webhookPurgePlatformQueue('all')).toEqual(['bling', 'mercado_livre', '*other'])
    expect(webhookPurgePlatformQueue('bling')).toEqual(['bling'])
  })
})
