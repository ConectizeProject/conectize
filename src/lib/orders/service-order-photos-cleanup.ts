import type { SupabaseClient } from '@supabase/supabase-js'
import { expandStoragePathsWithThumbs } from '@/lib/image/storage-paths'

export const SERVICE_ORDER_ENTRY_PHOTOS_BUCKET = 'order-entry-photos'
export const SERVICE_ORDER_EXIT_PHOTOS_BUCKET = 'order-exit-photos'
export const SERVICE_ORDER_ASSISTANCE_PHOTOS_BUCKET = 'order-assistance-photos'
export const SERVICE_ORDER_PHOTO_RETENTION_MONTHS = 3

const BATCH_SIZE = 100
const MAX_PASSES = 50

type PhotoRow = {
  id: string
  storage_path: string
}

type PhotoTable =
  | 'service_order_entry_photos'
  | 'service_order_exit_photos'
  | 'service_order_assistance_photos'

export type ServiceOrderPhotosCleanupPreview = {
  entryCount: number
  exitCount: number
  assistanceCount: number
  totalCount: number
  cutoffAt: string
  retentionMonths: number
}

export type ServiceOrderPhotosCleanupResult = ServiceOrderPhotosCleanupPreview & {
  entryDeleted: number
  exitDeleted: number
  assistanceDeleted: number
  storageRemoveErrors: number
}

export function getServiceOrderPhotoCutoffDate (): Date {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - SERVICE_ORDER_PHOTO_RETENTION_MONTHS)
  return cutoff
}

export function getServiceOrderPhotoCutoffIso (): string {
  return getServiceOrderPhotoCutoffDate().toISOString()
}

async function countOldPhotos (
  supabase: SupabaseClient,
  organizationId: string,
  table: PhotoTable,
  cutoffIso: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .lt('created_at', cutoffIso)

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

export async function previewOldServiceOrderPhotosCleanup (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ServiceOrderPhotosCleanupPreview> {
  const cutoffAt = getServiceOrderPhotoCutoffIso()
  const [entryCount, exitCount, assistanceCount] = await Promise.all([
    countOldPhotos(supabase, organizationId, 'service_order_entry_photos', cutoffAt),
    countOldPhotos(supabase, organizationId, 'service_order_exit_photos', cutoffAt),
    countOldPhotos(supabase, organizationId, 'service_order_assistance_photos', cutoffAt),
  ])

  return {
    entryCount,
    exitCount,
    assistanceCount,
    totalCount: entryCount + exitCount + assistanceCount,
    cutoffAt,
    retentionMonths: SERVICE_ORDER_PHOTO_RETENTION_MONTHS,
  }
}

async function cleanupPhotoTable (
  supabase: SupabaseClient,
  organizationId: string,
  cutoffIso: string,
  table: PhotoTable,
  bucket: string,
): Promise<{ deleted: number; storageRemoveErrors: number }> {
  let deleted = 0
  let storageRemoveErrors = 0

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const { data: rows, error } = await supabase
      .from(table)
      .select('id, storage_path')
      .eq('organization_id', organizationId)
      .lt('created_at', cutoffIso)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (error) {
      throw new Error(error.message)
    }

    const batch = (rows || []) as PhotoRow[]
    if (batch.length === 0) break

    const storagePaths = expandStoragePathsWithThumbs(
      batch
        .map((row) => String(row.storage_path || '').trim())
        .filter(Boolean),
    )

    if (storagePaths.length > 0) {
      const { error: rmErr } = await supabase.storage.from(bucket).remove(storagePaths)
      if (rmErr) {
        storageRemoveErrors += storagePaths.length
        console.warn(`[service-order-photos-cleanup] storage ${table}`, rmErr.message)
      }
    }

    const ids = batch.map((row) => row.id)
    const { error: delErr } = await supabase
      .from(table)
      .delete()
      .in('id', ids)
      .eq('organization_id', organizationId)

    if (delErr) {
      throw new Error(delErr.message)
    }

    deleted += batch.length
    if (batch.length < BATCH_SIZE) break
  }

  return { deleted, storageRemoveErrors }
}

export async function runOldServiceOrderPhotosCleanup (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ServiceOrderPhotosCleanupResult> {
  const preview = await previewOldServiceOrderPhotosCleanup(supabase, organizationId)
  const cutoffIso = preview.cutoffAt

  const [entryResult, exitResult, assistanceResult] = await Promise.all([
    cleanupPhotoTable(
      supabase,
      organizationId,
      cutoffIso,
      'service_order_entry_photos',
      SERVICE_ORDER_ENTRY_PHOTOS_BUCKET,
    ),
    cleanupPhotoTable(
      supabase,
      organizationId,
      cutoffIso,
      'service_order_exit_photos',
      SERVICE_ORDER_EXIT_PHOTOS_BUCKET,
    ),
    cleanupPhotoTable(
      supabase,
      organizationId,
      cutoffIso,
      'service_order_assistance_photos',
      SERVICE_ORDER_ASSISTANCE_PHOTOS_BUCKET,
    ),
  ])

  return {
    ...preview,
    entryDeleted: entryResult.deleted,
    exitDeleted: exitResult.deleted,
    assistanceDeleted: assistanceResult.deleted,
    storageRemoveErrors:
      entryResult.storageRemoveErrors +
      exitResult.storageRemoveErrors +
      assistanceResult.storageRemoveErrors,
  }
}
