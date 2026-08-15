import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createSignedPhotoUrls,
  type SignedPhotoUrls,
} from '@/lib/image/signed-photo-urls'

const BUCKET = 'resale-device-photos'

function parseExternalImageUrl (imageUrl: string | null | undefined): string | null {
  const raw = (imageUrl || '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol === 'https:' || u.protocol === 'http:') return raw
  } catch {
    return null
  }
  return null
}

export async function getResaleDeviceDisplayImageUrl (
  supabase: SupabaseClient,
  imageStoragePath: string | null | undefined,
  imageUrl: string | null | undefined,
  expiresInSeconds = 3600,
  variant: 'thumb' | 'full' = 'thumb',
): Promise<string | null> {
  const signed = await signResaleStorageOrExternal(
    supabase,
    imageStoragePath,
    imageUrl,
    expiresInSeconds,
  )
  if (variant === 'full') return signed.url ?? signed.thumbUrl
  return signed.thumbUrl ?? signed.url
}

type CoverImageSource = {
  image_storage_path?: string | null
  image_url?: string | null
  image_gallery_paths?: string[] | null
}

async function signResaleStorageOrExternal (
  supabase: SupabaseClient,
  imageStoragePath: string | null | undefined,
  imageUrl: string | null | undefined,
  expiresInSeconds: number,
): Promise<SignedPhotoUrls> {
  const path = (imageStoragePath || '').trim()
  if (path) {
    return createSignedPhotoUrls(supabase, BUCKET, path, expiresInSeconds)
  }
  const external = parseExternalImageUrl(imageUrl)
  if (external) return { url: external, thumbUrl: external }
  return { url: null, thumbUrl: null }
}

export async function getResaleDeviceCoverSignedUrls (
  supabase: SupabaseClient,
  device: CoverImageSource,
  expiresInSeconds = 3600,
): Promise<SignedPhotoUrls> {
  const main = await signResaleStorageOrExternal(
    supabase,
    device.image_storage_path,
    null,
    expiresInSeconds,
  )
  if (main.url || main.thumbUrl) return main

  const extras = Array.isArray(device.image_gallery_paths) ? device.image_gallery_paths : []
  for (const p of extras) {
    const path = (p || '').trim()
    if (!path) continue
    const signed = await createSignedPhotoUrls(supabase, BUCKET, path, expiresInSeconds)
    if (signed.url || signed.thumbUrl) return signed
  }

  const external = parseExternalImageUrl(device.image_url)
  if (external) return { url: external, thumbUrl: external }
  return { url: null, thumbUrl: null }
}

/** Capa: storage/URL principal; senão primeira imagem da galeria. */
export async function getResaleDeviceCoverDisplayUrl (
  supabase: SupabaseClient,
  device: CoverImageSource,
  expiresInSeconds = 3600,
  variant: 'thumb' | 'full' = 'thumb',
): Promise<string | null> {
  const signed = await getResaleDeviceCoverSignedUrls(supabase, device, expiresInSeconds)
  if (variant === 'full') return signed.url ?? signed.thumbUrl
  return signed.thumbUrl ?? signed.url
}

export async function attachResaleDeviceDisplayImage<
  T extends CoverImageSource,
> (
  supabase: SupabaseClient,
  device: T,
): Promise<T & { display_image_url: string | null; display_image_full_url: string | null }> {
  const signed = await getResaleDeviceCoverSignedUrls(supabase, device)
  return {
    ...device,
    display_image_url: signed.thumbUrl ?? signed.url,
    display_image_full_url: signed.url ?? signed.thumbUrl,
  }
}
