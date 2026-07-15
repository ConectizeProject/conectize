import type { SupabaseClient } from '@supabase/supabase-js'
import {
  SERVICE_ORDER_ENTRY_PHOTOS_BUCKET,
  SERVICE_ORDER_EXIT_PHOTOS_BUCKET,
} from '@/lib/orders/service-order-photos-cleanup'

export type ServiceOrderPhotoKind = 'entry' | 'exit'

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

const FOLDER_LIST_CONCURRENCY = 8
const SIGNED_URL_EXPIRES_SECONDS = 60 * 60

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
  table: 'service_order_entry_photos' | 'service_order_exit_photos',
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
    const { data: signed } = storagePath
      ? await supabase.storage.from(bucket).createSignedUrl(storagePath, expiresIn)
      : { data: null }

    return {
      id: row.id,
      kind,
      serviceOrderId: row.service_order_id,
      orderNumber: resolveOrderNumber(row.service_orders),
      storagePath,
      createdAt: row.created_at,
      sizeBytes: sizeMap.get(storagePath) ?? null,
      url: signed?.signedUrl ?? null,
    }
  }))
}

export async function listServiceOrderPhotosWithSizes (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ServiceOrderPhotoListItem[]> {
  const [entryRows, exitRows] = await Promise.all([
    fetchPhotoRows(supabase, organizationId, 'service_order_entry_photos'),
    fetchPhotoRows(supabase, organizationId, 'service_order_exit_photos'),
  ])

  const entryPaths = entryRows.map((row) => String(row.storage_path || '').trim()).filter(Boolean)
  const exitPaths = exitRows.map((row) => String(row.storage_path || '').trim()).filter(Boolean)

  const [entrySizes, exitSizes] = await Promise.all([
    buildStorageSizeMap(supabase, SERVICE_ORDER_ENTRY_PHOTOS_BUCKET, entryPaths),
    buildStorageSizeMap(supabase, SERVICE_ORDER_EXIT_PHOTOS_BUCKET, exitPaths),
  ])

  const [entryItems, exitItems] = await Promise.all([
    mapRowsToListItems(supabase, entryRows, 'entry', SERVICE_ORDER_ENTRY_PHOTOS_BUCKET, entrySizes),
    mapRowsToListItems(supabase, exitRows, 'exit', SERVICE_ORDER_EXIT_PHOTOS_BUCKET, exitSizes),
  ])

  return [...entryItems, ...exitItems].sort((a, b) => {
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
  const table = kind === 'entry' ? 'service_order_entry_photos' : 'service_order_exit_photos'
  const bucket = kind === 'entry' ? SERVICE_ORDER_ENTRY_PHOTOS_BUCKET : SERVICE_ORDER_EXIT_PHOTOS_BUCKET

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
    const { error: rmErr } = await supabase.storage.from(bucket).remove([storagePath])
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
