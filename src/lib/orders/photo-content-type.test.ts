import { describe, expect, it } from 'vitest'
import { contentTypeForPhoto } from '@/lib/orders/photo-content-type'

describe('contentTypeForPhoto', () => {
  it('ignores octet-stream so nosniff can still display the image', () => {
    expect(contentTypeForPhoto('os/id.jpg', 'application/octet-stream')).toBe('image/jpeg')
  })

  it('keeps a real image MIME from storage', () => {
    expect(contentTypeForPhoto('os/id.png', 'image/png')).toBe('image/png')
  })
})
