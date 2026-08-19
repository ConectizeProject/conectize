import { describe, expect, it } from 'vitest'
import { toStorageUploadBody } from '@/lib/image/to-storage-upload-body'

describe('toStorageUploadBody', () => {
  it('keeps JPEG SOI bytes that Buffer UTF-8 stringify would destroy', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    const corrupted = Buffer.from(jpeg.toString('utf8'), 'utf8')
    expect(corrupted[0]).toBe(0xef)
    expect(corrupted[1]).toBe(0xbf)
    expect(corrupted[2]).toBe(0xbd)

    const body = toStorageUploadBody(jpeg)
    expect([...body.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff])
  })
})
