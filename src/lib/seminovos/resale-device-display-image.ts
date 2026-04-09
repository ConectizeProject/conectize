import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'resale-device-photos'

/**
 * URL para exibir a foto do aparelho: assinada (Storage) ou URL externa.
 */
export async function getResaleDeviceDisplayImageUrl (
  supabase: SupabaseClient,
  imageStoragePath: string | null | undefined,
  imageUrl: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const path = (imageStoragePath || '').trim()
  if (path) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresInSeconds)
    if (error) {
      console.error('[getResaleDeviceDisplayImageUrl]', error)
      return null
    }
    return data?.signedUrl ?? null
  }
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

export async function attachResaleDeviceDisplayImage<
  T extends { image_storage_path?: string | null; image_url?: string | null },
> (
  supabase: SupabaseClient,
  device: T,
): Promise<T & { display_image_url: string | null }> {
  const display_image_url = await getResaleDeviceDisplayImageUrl(
    supabase,
    device.image_storage_path,
    device.image_url,
  )
  return { ...device, display_image_url }
}
