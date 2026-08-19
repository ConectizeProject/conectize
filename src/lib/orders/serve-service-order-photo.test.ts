import { describe, expect, it } from 'vitest'
import {
  mapRowsToPortalPhotoItems,
  portalServiceOrderPhotoFileUrl,
} from '@/lib/orders/service-order-photo-urls'

describe('portalServiceOrderPhotoFileUrl', () => {
  it('builds same-origin file URLs', () => {
    const orderId = '11111111-1111-4111-8111-111111111111'
    const photoId = '22222222-2222-4222-8222-222222222222'
    expect(portalServiceOrderPhotoFileUrl(orderId, 'entry-photos', photoId, 'thumb'))
      .toBe(`/api/portal/ordens/${orderId}/entry-photos/${photoId}?variant=thumb`)
  })

  it('maps list rows to file URLs without signed storage links', () => {
    const orderId = '11111111-1111-4111-8111-111111111111'
    const photos = mapRowsToPortalPhotoItems(orderId, 'entry-photos', [
      { id: '22222222-2222-4222-8222-222222222222', created_at: '2026-01-01' },
    ])
    expect(photos[0].url).toContain('/api/portal/ordens/')
    expect(photos[0].url).toContain('variant=full')
    expect(photos[0].thumbUrl).toContain('variant=thumb')
  })
})
