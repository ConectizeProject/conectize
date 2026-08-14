import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createImageUploadVariants } from '@/lib/image/process-upload-image'
import { expandStoragePathsWithThumbs, toThumbStoragePath } from '@/lib/image/storage-paths'

const JPEG_CONTENT_TYPE = 'image/jpeg'

export type SignedPhotoUrls = {
  url: string | null
  thumbUrl: string | null
}

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

export async function removeStoragePathsWithThumbs (
  supabase: SupabaseClient,
  bucket: string,
  paths: string[],
): Promise<void> {
  const toRemove = expandStoragePathsWithThumbs(paths)
  if (toRemove.length === 0) return
  await supabase.storage.from(bucket).remove(toRemove)
}

function pickSignedUrl (
  items: Array<{ error: string | null; path: string | null; signedUrl: string | null }>,
  wantedPath: string,
  indexHint: number,
): string | null {
  const exact = items.find((item) => item.path === wantedPath)
  const bySuffix = items.find((item) => {
    const p = item.path || ''
    return p.endsWith(wantedPath) || wantedPath.endsWith(p)
  })
  const item = exact || bySuffix || items[indexHint]
  if (!item || item.error) return null
  return item.signedUrl || null
}

export async function createSignedPhotoUrls (
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string,
  expiresInSeconds: number,
): Promise<SignedPhotoUrls> {
  const path = storagePath.trim()
  if (!path) return { url: null, thumbUrl: null }

  const thumbPath = toThumbStoragePath(path)
  const paths = thumbPath === path ? [path] : [path, thumbPath]
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, expiresInSeconds)

  if (error || !data) {
    console.error('[createSignedPhotoUrls]', error)
    return { url: null, thumbUrl: null }
  }

  const url = pickSignedUrl(data, path, 0)
  const thumbUrl = thumbPath === path ? url : pickSignedUrl(data, thumbPath, 1)
  return { url, thumbUrl }
}
