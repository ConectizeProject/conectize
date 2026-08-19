import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { expandStoragePathsWithThumbs, toThumbStoragePath } from '@/lib/image/storage-paths'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

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

function signingClient (fallback: SupabaseClient): SupabaseClient {
  try {
    return createSupabaseServiceClient()
  } catch {
    return fallback
  }
}

async function signOne (
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  expiresInSeconds: number,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function createSignedPhotoUrls (
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string,
  expiresInSeconds: number,
): Promise<SignedPhotoUrls> {
  const path = storagePath.trim()
  if (!path) return { url: null, thumbUrl: null }

  const client = signingClient(supabase)
  const thumbPath = toThumbStoragePath(path)

  const url = await signOne(client, bucket, path, expiresInSeconds)
  if (thumbPath === path) return { url, thumbUrl: url }

  const thumbUrl = await signOne(client, bucket, thumbPath, expiresInSeconds)
  return { url, thumbUrl }
}
