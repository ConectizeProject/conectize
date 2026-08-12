import 'server-only'
import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export const ORGANIZATION_LOGOS_BUCKET = 'organization-logos'
export const ORGANIZATION_LOGO_MAX_BYTES = 2 * 1024 * 1024

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
])

export type OrganizationLogoUploadError =
  | 'no_file'
  | 'invalid_type'
  | 'file_too_large'
  | 'upload_failed'

export type OrganizationLogoUploadResult =
  | { ok: true, publicUrl: string, storagePath: string }
  | { ok: false, error: OrganizationLogoUploadError }

function extensionForMime (mime: string) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/svg+xml') return 'svg'
  return 'jpg'
}

export function isOrganizationLogoFile (value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File && value.size > 0
}

export async function uploadOrganizationLogo (
  supabase: SupabaseClient,
  organizationId: string,
  file: File | Blob,
): Promise<OrganizationLogoUploadResult> {
  if (!file || !(file instanceof Blob) || file.size <= 0) {
    return { ok: false, error: 'no_file' }
  }

  if (file.size > ORGANIZATION_LOGO_MAX_BYTES) {
    return { ok: false, error: 'file_too_large' }
  }

  const mime = (file as File).type || 'image/jpeg'
  if (!ALLOWED_MIME.has(mime)) {
    return { ok: false, error: 'invalid_type' }
  }

  const ext = extensionForMime(mime)
  const storagePath = `${organizationId}/${randomUUID()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabase.storage
    .from(ORGANIZATION_LOGOS_BUCKET)
    .upload(storagePath, buf, { contentType: mime, upsert: false })

  if (upErr) {
    console.error('[organization-logo upload]', upErr)
    return { ok: false, error: 'upload_failed' }
  }

  const { data } = supabase.storage
    .from(ORGANIZATION_LOGOS_BUCKET)
    .getPublicUrl(storagePath)

  const publicUrl = String(data?.publicUrl || '').trim()
  if (!publicUrl) {
    await supabase.storage.from(ORGANIZATION_LOGOS_BUCKET).remove([storagePath])
    return { ok: false, error: 'upload_failed' }
  }

  return { ok: true, publicUrl, storagePath }
}

/** Remove objetos cujo path começa com o id da organização (pasta do logo). */
export async function removeOrganizationLogoFolder (
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data: listed } = await supabase.storage
    .from(ORGANIZATION_LOGOS_BUCKET)
    .list(organizationId, { limit: 50 })

  const paths = (listed || [])
    .map((item) => item?.name)
    .filter((name): name is string => Boolean(name))
    .map((name) => `${organizationId}/${name}`)

  if (paths.length === 0) return
  await supabase.storage.from(ORGANIZATION_LOGOS_BUCKET).remove(paths)
}
