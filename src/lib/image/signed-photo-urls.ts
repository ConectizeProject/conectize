import type { SupabaseClient } from '@supabase/supabase-js'
import { expandStoragePathsWithThumbs, toThumbStoragePath } from '@/lib/image/storage-paths'

export type SignedPhotoUrls = {
  url: string | null
  thumbUrl: string | null
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
