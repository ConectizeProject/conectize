import type { SupabaseClient } from '@supabase/supabase-js'
import { createSignedPhotoUrls } from '@/lib/image/upload-compressed-image'
import { expandStoragePathsWithThumbs, toThumbStoragePath } from '@/lib/image/storage-paths'
import {
  SERVICE_ORDER_ASSISTANCE_PHOTOS_BUCKET,
  SERVICE_ORDER_ENTRY_PHOTOS_BUCKET,
  SERVICE_ORDER_EXIT_PHOTOS_BUCKET,
} from '@/lib/orders/service-order-photos-cleanup'

export type ServiceOrderPhotoKind = 'entry' | 'exit' | 'assistance'

export type ServiceOrderPhotoListItem = {
  id: string
  kind: ServiceOrderPhotoKind
  serviceOrderId: string
  orderNumber: string | null
  storagePath: string
  createdAt: string
  sizeBytes: number | null
  url: string | null
}

type PhotoDbRow = {
  id: string
  service_order_id: string
  storage_path: string
  created_at: string
  service_orders: { display_number: string | null } | { display_number: string | null }[] | null
}

type PhotoTable =
  | 'service_order_entry_photos'
  | 'service_order_exit_photos'
  | 'service_order_assistance_photos'

const FOLDER_LIST_CONCURRENCY = 8
const SIGNED_URL_EXPIRES_SECONDS = 60 * 60

const KIND_TABLE: Record<ServiceOrderPhotoKind, PhotoTable> = {
  entry: 'service_order_entry_photos',
  exit: 'service_order_exit_photos',
  assistance: 'service_order_assistance_photos',
}

const KIND_BUCKET: Record<ServiceOrderPhotoKind, string> = {
  entry: SERVICE_ORDER_ENTRY_PHOTOS_BUCKET,
  exit: SERVICE_ORDER_EXIT_PHOTOS_BUCKET,
  assistance: SERVICE_ORDER_ASSISTANCE_PHOTOS_BUCKET,
}

function resolveOrderNumber (
  serviceOrders: PhotoDbRow['service_orders'],
): string | null {
  if (!serviceOrders) return null
  if (Array.isArray(serviceOrders)) {
    return serviceOrders[0]?.display_number ?? null
  }
  return serviceOrders.display_number ?? null
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

async function buildStorageSizeMap (
  supabase: SupabaseClient,
  bucket: string,
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
      const { data, error } = await supabase.storage.from(bucket).list(folderId, { limit: 100 })
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

async function fetchPhotoRows (
  supabase: SupabaseClient,
  organizationId: string,
  table: PhotoTable,
): Promise<PhotoDbRow[]> {
  const { data, error } = await supabase
    .from(table)
    .select('id, service_order_id, storage_path, created_at, service_orders(display_number)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as PhotoDbRow[]
}

async function mapRowsToListItems (
  supabase: SupabaseClient,
  rows: PhotoDbRow[],
  kind: ServiceOrderPhotoKind,
  bucket: string,
  sizeMap: Map<string, number>,
): Promise<ServiceOrderPhotoListItem[]> {
  const expiresIn = SIGNED_URL_EXPIRES_SECONDS

  return Promise.all(rows.map(async (row) => {
    const storagePath = String(row.storage_path || '').trim()
    const signed = storagePath
      ? await createSignedPhotoUrls(supabase, bucket, storagePath, expiresIn)
      : { url: null, thumbUrl: null }
    const thumbPath = storagePath ? toThumbStoragePath(storagePath) : ''
    const fullBytes = sizeMap.get(storagePath)
    const thumbBytes = thumbPath ? sizeMap.get(thumbPath) : undefined
    const sizeBytes =
      fullBytes == null && thumbBytes == null
        ? null
        : (fullBytes ?? 0) + (thumbBytes ?? 0)

    return {
      id: row.id,
      kind,
      serviceOrderId: row.service_order_id,
      orderNumber: resolveOrderNumber(row.service_orders),
      storagePath,
      createdAt: row.created_at,
      sizeBytes,
      url: signed.thumbUrl ?? signed.url,
    }
  }))
}

export async function listServiceOrderPhotosWithSizes (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ServiceOrderPhotoListItem[]> {
  const [entryRows, exitRows, assistanceRows] = await Promise.all([
    fetchPhotoRows(supabase, organizationId, 'service_order_entry_photos'),
    fetchPhotoRows(supabase, organizationId, 'service_order_exit_photos'),
    fetchPhotoRows(supabase, organizationId, 'service_order_assistance_photos'),
  ])

  const entryPaths = entryRows.map((row) => String(row.storage_path || '').trim()).filter(Boolean)
  const exitPaths = exitRows.map((row) => String(row.storage_path || '').trim()).filter(Boolean)
  const assistancePaths = assistanceRows.map((row) => String(row.storage_path || '').trim()).filter(Boolean)

  const [entrySizes, exitSizes, assistanceSizes] = await Promise.all([
    buildStorageSizeMap(supabase, SERVICE_ORDER_ENTRY_PHOTOS_BUCKET, expandStoragePathsWithThumbs(entryPaths)),
    buildStorageSizeMap(supabase, SERVICE_ORDER_EXIT_PHOTOS_BUCKET, expandStoragePathsWithThumbs(exitPaths)),
    buildStorageSizeMap(supabase, SERVICE_ORDER_ASSISTANCE_PHOTOS_BUCKET, expandStoragePathsWithThumbs(assistancePaths)),
  ])

  const [entryItems, exitItems, assistanceItems] = await Promise.all([
    mapRowsToListItems(supabase, entryRows, 'entry', SERVICE_ORDER_ENTRY_PHOTOS_BUCKET, entrySizes),
    mapRowsToListItems(supabase, exitRows, 'exit', SERVICE_ORDER_EXIT_PHOTOS_BUCKET, exitSizes),
    mapRowsToListItems(
      supabase,
      assistanceRows,
      'assistance',
      SERVICE_ORDER_ASSISTANCE_PHOTOS_BUCKET,
      assistanceSizes,
    ),
  ])

  return [...entryItems, ...exitItems, ...assistanceItems].sort((a, b) => {
    const sizeA = a.sizeBytes ?? -1
    const sizeB = b.sizeBytes ?? -1
    if (sizeB !== sizeA) return sizeB - sizeA
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export async function deleteServiceOrderPhoto (
  supabase: SupabaseClient,
  organizationId: string,
  photoId: string,
  kind: ServiceOrderPhotoKind,
): Promise<void> {
  const table = KIND_TABLE[kind]
  const bucket = KIND_BUCKET[kind]

  const { data: row, error: findErr } = await supabase
    .from(table)
    .select('id, storage_path')
    .eq('id', photoId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (findErr) {
    throw new Error(findErr.message)
  }
  if (!row) {
    throw new Error('not_found')
  }

  const storagePath = String(row.storage_path || '').trim()
  if (storagePath) {
    const { error: rmErr } = await supabase.storage
      .from(bucket)
      .remove(expandStoragePathsWithThumbs([storagePath]))
    if (rmErr) {
      console.warn('[service-order-photos-admin delete] storage', rmErr.message)
    }
  }

  const { error: delErr } = await supabase
    .from(table)
    .delete()
    .eq('id', photoId)
    .eq('organization_id', organizationId)

  if (delErr) {
    throw new Error(delErr.message)
  }
}

export function formatPhotoSizeBytes (bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
