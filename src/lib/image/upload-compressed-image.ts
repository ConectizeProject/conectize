import 'server-only'
import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createImageUploadVariants } from '@/lib/image/process-upload-image'
import { toThumbStoragePath } from '@/lib/image/storage-paths'

const JPEG_CONTENT_TYPE = 'image/jpeg'

export async function uploadCompressedImageWithThumb (opts: {
  supabase: SupabaseClient
  bucket: string
  folder: string
  bytes: Buffer
}): Promise<{ path: string } | { error: string }> {
  const id = randomUUID()
  const path = `${opts.folder}/${id}.jpg`
  const thumbPath = toThumbStoragePath(path)

  let full: Buffer
  let thumb: Buffer
  try {
    const variants = await createImageUploadVariants(opts.bytes)
    full = variants.full
    thumb = variants.thumb
  } catch (err) {
    console.error('[uploadCompressedImageWithThumb] process', err)
    return { error: 'process_failed' }
  }

  const { error: fullErr } = await opts.supabase.storage
    .from(opts.bucket)
    .upload(path, full, { contentType: JPEG_CONTENT_TYPE, upsert: false })

  if (fullErr) {
    console.error('[uploadCompressedImageWithThumb] full', fullErr)
    return { error: 'upload_failed' }
  }

  const { error: thumbErr } = await opts.supabase.storage
    .from(opts.bucket)
    .upload(thumbPath, thumb, { contentType: JPEG_CONTENT_TYPE, upsert: false })

  if (thumbErr) {
    console.error('[uploadCompressedImageWithThumb] thumb', thumbErr)
    await opts.supabase.storage.from(opts.bucket).remove([path])
    return { error: 'upload_failed' }
  }

  return { path }
}
