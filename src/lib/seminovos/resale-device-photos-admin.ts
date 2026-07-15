import type { SupabaseClient } from '@supabase/supabase-js'

export const RESALE_DEVICE_PHOTOS_BUCKET = 'resale-device-photos'

const FOLDER_LIST_CONCURRENCY = 8
const SIGNED_URL_EXPIRES_SECONDS = 60 * 60

export type ResaleDevicePhotoKind = 'cover' | 'gallery'

export type ResaleDevicePhotoListItem = {
  id: string
  kind: ResaleDevicePhotoKind
  deviceId: string
  deviceLabel: string
  storagePath: string
  createdAt: string
  sizeBytes: number | null
  url: string | null
}

type ResaleDeviceRow = {
  id: string
  device_name: string | null
  model: string | null
  storage_gb: string | null
  color: string | null
  sold?: boolean | null
  image_storage_path: string | null
  image_gallery_paths: string[] | null
  created_at: string
}

export type ResaleDevicePhotosBulkCleanupResult = {
  affectedDevices: number
  deletedPhotos: number
  storageRemoveErrors: number
}

function encodePhotoId (path: string): string {
  return Buffer.from(path, 'utf8').toString('base64url')
}

export function decodeResaleDevicePhotoId (photoId: string): string {
  return Buffer.from(photoId, 'base64url').toString('utf8')
}

function parseStorageSize (metadata: Record<string, unknown> | null | undefined): number | null {
  const raw = metadata?.size
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function buildDeviceLabel (row: ResaleDeviceRow): string {
  const parts = [
    row.device_name,
    row.model,
    row.storage_gb ? `${row.storage_gb} GB` : null,
    row.color,
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean)

  return parts.length > 0 ? parts.join(' · ') : 'Sem identificação'
}

function normalizeGalleryPaths (paths: string[] | null | undefined): string[] {
  return Array.isArray(paths)
    ? paths.map((path) => String(path || '').trim()).filter(Boolean)
    : []
}

async function removeStoragePaths (supabase: SupabaseClient, paths: string[]): Promise<number> {
  const unique = [...new Set(paths.map((path) => String(path || '').trim()).filter(Boolean))]
  if (unique.length === 0) return 0

  const { error } = await supabase.storage
    .from(RESALE_DEVICE_PHOTOS_BUCKET)
    .remove(unique)

  if (error) {
    console.warn('[resale-device-photos-admin bulk] storage', error.message)
    return unique.length
  }

  return 0
}

async function buildStorageSizeMap (
  supabase: SupabaseClient,
  paths: string[],
): Promise<Map<string, number>> {
  const sizeMap = new Map<string, number>()
  const folders = new Map<string, Set<string>>()

  for (const path of paths) {
    const slash = path.indexOf('/')
    if (slash <= 0) continue
    const folder = path.slice(0, slash)
    const fileName = path.slice(slash + 1)
    if (!fileName) continue
    if (!folders.has(folder)) folders.set(folder, new Set())
    folders.get(folder)?.add(fileName)
  }

  const folderIds = [...folders.keys()]
  for (let i = 0; i < folderIds.length; i += FOLDER_LIST_CONCURRENCY) {
    const chunk = folderIds.slice(i, i + FOLDER_LIST_CONCURRENCY)
    await Promise.all(chunk.map(async (folderId) => {
      const { data, error } = await supabase.storage
        .from(RESALE_DEVICE_PHOTOS_BUCKET)
        .list(folderId, { limit: 100 })
      if (error || !data) return

      const wanted = folders.get(folderId)
      if (!wanted) return

      for (const file of data) {
        if (!wanted.has(file.name)) continue
        const fullPath = `${folderId}/${file.name}`
        const size = parseStorageSize(file.metadata as Record<string, unknown> | undefined)
        if (size !== null) sizeMap.set(fullPath, size)
      }
    }))
  }

  return sizeMap
}

function collectPhotoRows (rows: ResaleDeviceRow[], sizeMap: Map<string, number>): ResaleDevicePhotoListItem[] {
  const items: ResaleDevicePhotoListItem[] = []

  for (const row of rows) {
    const deviceLabel = buildDeviceLabel(row)
    const coverPath = String(row.image_storage_path || '').trim()
    if (coverPath) {
      items.push({
        id: encodePhotoId(coverPath),
        kind: 'cover',
        deviceId: row.id,
        deviceLabel,
        storagePath: coverPath,
        createdAt: row.created_at,
        sizeBytes: sizeMap.get(coverPath) ?? null,
        url: null,
      })
    }

    const galleryPaths = normalizeGalleryPaths(row.image_gallery_paths)
    for (const galleryPath of galleryPaths) {
      items.push({
        id: encodePhotoId(galleryPath),
        kind: 'gallery',
        deviceId: row.id,
        deviceLabel,
        storagePath: galleryPath,
        createdAt: row.created_at,
        sizeBytes: sizeMap.get(galleryPath) ?? null,
        url: null,
      })
    }
  }

  return items
}

export async function listResaleDevicePhotosWithSizes (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ResaleDevicePhotoListItem[]> {
  const { data, error } = await supabase
    .from('resale_devices')
    .select('id, device_name, model, storage_gb, color, image_storage_path, image_gallery_paths, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as ResaleDeviceRow[]
  const paths = rows.flatMap((row) => [
    String(row.image_storage_path || '').trim(),
    ...normalizeGalleryPaths(row.image_gallery_paths),
  ]).filter(Boolean)

  const sizeMap = await buildStorageSizeMap(supabase, paths)
  const items = collectPhotoRows(rows, sizeMap).sort((a, b) => {
    const sizeA = a.sizeBytes ?? -1
    const sizeB = b.sizeBytes ?? -1
    if (sizeB !== sizeA) return sizeB - sizeA
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  if (items.length === 0) return items

  return Promise.all(items.map(async (item) => {
    const { data: signed } = await supabase.storage
      .from(RESALE_DEVICE_PHOTOS_BUCKET)
      .createSignedUrl(item.storagePath, SIGNED_URL_EXPIRES_SECONDS)
    return {
      ...item,
      url: signed?.signedUrl ?? null,
    }
  }))
}

export async function deleteResaleDevicePhoto (
  supabase: SupabaseClient,
  organizationId: string,
  deviceId: string,
  photoId: string,
  kind: ResaleDevicePhotoKind,
): Promise<void> {
  const storagePath = decodeResaleDevicePhotoId(photoId).trim()
  if (!storagePath) {
    throw new Error('invalid_id')
  }

  const { data: row, error: findErr } = await supabase
    .from('resale_devices')
    .select('id, image_storage_path, image_gallery_paths')
    .eq('id', deviceId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (findErr) {
    throw new Error(findErr.message)
  }
  if (!row) {
    throw new Error('not_found')
  }

  const coverPath = String(row.image_storage_path || '').trim()
  const galleryPaths = normalizeGalleryPaths(row.image_gallery_paths)

  if (kind === 'cover' && coverPath !== storagePath) {
    throw new Error('not_found')
  }
  if (kind === 'gallery' && !galleryPaths.includes(storagePath)) {
    throw new Error('not_found')
  }

  const { error: rmErr } = await supabase.storage
    .from(RESALE_DEVICE_PHOTOS_BUCKET)
    .remove([storagePath])
  if (rmErr) {
    console.warn('[resale-device-photos-admin delete] storage', rmErr.message)
  }

  const patch = kind === 'cover'
    ? { image_storage_path: null }
    : { image_gallery_paths: galleryPaths.filter((path) => path !== storagePath) }

  const { error: upErr } = await supabase
    .from('resale_devices')
    .update(patch)
    .eq('id', deviceId)
    .eq('organization_id', organizationId)

  if (upErr) {
    throw new Error(upErr.message)
  }
}

export async function keepOnlyFirstResaleDevicePhoto (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ResaleDevicePhotosBulkCleanupResult> {
  const { data, error } = await supabase
    .from('resale_devices')
    .select('id, image_storage_path, image_gallery_paths')
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  const stats: ResaleDevicePhotosBulkCleanupResult = {
    affectedDevices: 0,
    deletedPhotos: 0,
    storageRemoveErrors: 0,
  }

  for (const row of (data ?? []) as ResaleDeviceRow[]) {
    const coverPath = String(row.image_storage_path || '').trim()
    const galleryPaths = normalizeGalleryPaths(row.image_gallery_paths)
    const orderedPaths = [coverPath, ...galleryPaths].filter(Boolean)
    if (orderedPaths.length <= 1) continue

    const keepPath = orderedPaths[0]
    const removePaths = orderedPaths.slice(1)
    const { error: upErr } = await supabase
      .from('resale_devices')
      .update({
        image_storage_path: keepPath,
        image_gallery_paths: [],
      })
      .eq('id', row.id)
      .eq('organization_id', organizationId)

    if (upErr) {
      throw new Error(upErr.message)
    }

    stats.storageRemoveErrors += await removeStoragePaths(supabase, removePaths)
    stats.affectedDevices += 1
    stats.deletedPhotos += removePaths.length
  }

  return stats
}

export async function deleteSoldResaleDevicePhotos (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ResaleDevicePhotosBulkCleanupResult> {
  const { data, error } = await supabase
    .from('resale_devices')
    .select('id, image_storage_path, image_gallery_paths')
    .eq('organization_id', organizationId)
    .eq('sold', true)

  if (error) {
    throw new Error(error.message)
  }

  const stats: ResaleDevicePhotosBulkCleanupResult = {
    affectedDevices: 0,
    deletedPhotos: 0,
    storageRemoveErrors: 0,
  }

  for (const row of (data ?? []) as ResaleDeviceRow[]) {
    const coverPath = String(row.image_storage_path || '').trim()
    const galleryPaths = normalizeGalleryPaths(row.image_gallery_paths)
    const removePaths = [coverPath, ...galleryPaths].filter(Boolean)
    if (removePaths.length === 0) continue

    const { error: upErr } = await supabase
      .from('resale_devices')
      .update({
        image_storage_path: null,
        image_gallery_paths: [],
      })
      .eq('id', row.id)
      .eq('organization_id', organizationId)

    if (upErr) {
      throw new Error(upErr.message)
    }

    stats.storageRemoveErrors += await removeStoragePaths(supabase, removePaths)
    stats.affectedDevices += 1
    stats.deletedPhotos += removePaths.length
  }

  return stats
}
