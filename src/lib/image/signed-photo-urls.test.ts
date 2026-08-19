import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => {
    throw new Error('no service key in test')
  },
}))

import { createSignedPhotoUrls } from '@/lib/image/signed-photo-urls'

function mockStorage (signedByPath: Record<string, string | null>) {
  return {
    storage: {
      from () {
        return {
          async createSignedUrl (path: string) {
            const signedUrl = signedByPath[path]
            if (!signedUrl) {
              return { data: null, error: { message: 'not allowed' } }
            }
            return { data: { signedUrl }, error: null }
          },
        }
      },
    },
  }
}

describe('createSignedPhotoUrls', () => {
  it('keeps the full image URL when the thumb cannot be signed', async () => {
    const full = 'order-id/photo.jpg'
    const supabase = mockStorage({
      [full]: 'https://cdn.example/full.jpg',
    })

    const signed = await createSignedPhotoUrls(
      supabase as never,
      'order-entry-photos',
      full,
      3600,
    )

    expect(signed.url).toBe('https://cdn.example/full.jpg')
    expect(signed.thumbUrl).toBeNull()
  })

  it('signs full and thumb independently', async () => {
    const full = 'order-id/photo.png'
    const supabase = mockStorage({
      [full]: 'https://cdn.example/full.png',
      'order-id/photo.thumb.jpg': 'https://cdn.example/thumb.jpg',
    })

    const signed = await createSignedPhotoUrls(
      supabase as never,
      'order-entry-photos',
      full,
      3600,
    )

    expect(signed.url).toBe('https://cdn.example/full.png')
    expect(signed.thumbUrl).toBe('https://cdn.example/thumb.jpg')
  })
})
