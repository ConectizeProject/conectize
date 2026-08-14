import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createSignedPhotoUrls,
  removeStoragePathsWithThumbs,
  uploadCompressedImageWithThumb,
} from '@/lib/image/upload-compressed-image'

export type ServiceOrderPhotoTable =
  | 'service_order_entry_photos'
  | 'service_order_exit_photos'
  | 'service_order_assistance_photos'

export type SignedServiceOrderPhoto = {
  id: string
  url: string | null
  thumbUrl: string | null
  created_at: string
}

export async function signServiceOrderPhotoRows (
  supabase: SupabaseClient,
  bucket: string,
  rows: Array<{ id: string; storage_path: string; created_at: string }> | null,
  expiresInSeconds: number,
): Promise<SignedServiceOrderPhoto[]> {
  return Promise.all(
    (rows ?? []).map(async (row) => {
      const signed = await createSignedPhotoUrls(
        supabase,
        bucket,
        row.storage_path,
        expiresInSeconds,
      )
      return {
        id: row.id,
        url: signed.url,
        thumbUrl: signed.thumbUrl,
        created_at: row.created_at,
      }
    }),
  )
}

export async function uploadServiceOrderPhotoBlob (opts: {
  supabase: SupabaseClient
  bucket: string
  table: ServiceOrderPhotoTable
  orderId: string
  organizationId: string
  file: Blob
}): Promise<{ id: string } | null> {
  const bytes = Buffer.from(await opts.file.arrayBuffer())
  const uploaded = await uploadCompressedImageWithThumb({
    supabase: opts.supabase,
    bucket: opts.bucket,
    folder: opts.orderId,
    bytes,
  })
  if ('error' in uploaded) return null

  const { data: ins, error: insErr } = await opts.supabase
    .from(opts.table)
    .insert({
      service_order_id: opts.orderId,
      storage_path: uploaded.path,
      organization_id: opts.organizationId,
    })
    .select('id')
    .single()

  if (insErr || !ins?.id) {
    await removeStoragePathsWithThumbs(opts.supabase, opts.bucket, [uploaded.path])
    return null
  }

  return { id: ins.id }
}

export async function deleteServiceOrderPhotoFile (
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string,
): Promise<void> {
  await removeStoragePathsWithThumbs(supabase, bucket, [storagePath])
}
