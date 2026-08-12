import type { SupabaseClient } from '@supabase/supabase-js'
import { listServiceOrderPhotosWithSizes } from '@/lib/orders/service-order-photos-admin'
import {
  SERVICE_ORDER_ENTRY_PHOTOS_BUCKET,
  SERVICE_ORDER_EXIT_PHOTOS_BUCKET,
} from '@/lib/orders/service-order-photos-cleanup'
import { listResaleDevicePhotosWithSizes, RESALE_DEVICE_PHOTOS_BUCKET } from '@/lib/seminovos/resale-device-photos-admin'
import { listStoredWhatsappImages } from '@/lib/whatsapp/whatsapp-media-admin'
import { WHATSAPP_MEDIA_BUCKET } from '@/lib/whatsapp/whatsapp-media-types'

const GIB = 1024 * 1024 * 1024

export type StorageUsageBucket = {
  bucketId: string
  fileCount: number
  bytes: number
}

export type StorageUsageCategoryKey = 'os_entry' | 'os_exit' | 'whatsapp' | 'resale'

export type StorageUsageCategory = {
  key: StorageUsageCategoryKey
  label: string
  fileCount: number
  bytes: number
}

export type ProjectStorageQuota = {
  limitBytes: number | null
  plan: string | null
  quotaSource: 'api' | 'env' | 'default' | 'none'
  error?: string
}

export type StorageUsageSummary = {
  project: {
    usedBytes: number
    limitBytes: number | null
    plan: string | null
    quotaSource: ProjectStorageQuota['quotaSource']
    quotaError?: string
  }
  organization: {
    totalBytes: number
    categories: StorageUsageCategory[]
  }
  buckets: StorageUsageBucket[]
}

type RawStorageUsageSummary = {
  project_total_bytes?: unknown
  project_buckets?: unknown
  org_total_bytes?: unknown
  org_categories?: unknown
}

type SupabaseOrganizationResponse = {
  plan?: string
}

function toNumber (value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function toBucket (value: unknown): StorageUsageBucket | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const bucketId = String(row.bucketId || '').trim()
  if (!bucketId) return null
  return {
    bucketId,
    fileCount: toNumber(row.fileCount),
    bytes: toNumber(row.bytes),
  }
}

function toCategory (value: unknown): StorageUsageCategory | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const key = String(row.key || '').trim() as StorageUsageCategoryKey
  if (!['os_entry', 'os_exit', 'whatsapp', 'resale'].includes(key)) return null
  return {
    key,
    label: String(row.label || key),
    fileCount: toNumber(row.fileCount),
    bytes: toNumber(row.bytes),
  }
}

function quotaFromPlan (plan: string | null): number | null {
  const normalized = String(plan || '').toLowerCase()
  if (normalized === 'free') return GIB
  if (normalized === 'pro' || normalized === 'team') return 100 * GIB
  return null
}

function isMissingRpcError (message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('admin_storage_usage_summary')
    && (normalized.includes('could not find the function') || normalized.includes('schema cache'))
}

function buildCategory (
  key: StorageUsageCategoryKey,
  label: string,
  fileCount: number,
  bytes: number,
): StorageUsageCategory {
  return { key, label, fileCount, bytes }
}

function buildBucket (bucketId: string, fileCount: number, bytes: number): StorageUsageBucket {
  return { bucketId, fileCount, bytes }
}

function quotaFromEnv (): ProjectStorageQuota | null {
  const raw = String(process.env.SUPABASE_STORAGE_QUOTA_GB || '').trim()
  if (!raw) return null
  const gb = Number(raw.replace(',', '.'))
  if (!Number.isFinite(gb) || gb <= 0) return null
  return {
    limitBytes: Math.round(gb * GIB),
    plan: null,
    quotaSource: 'env',
  }
}

async function fetchSupabasePlanQuota (): Promise<ProjectStorageQuota | null> {
  const token = String(process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN || '').trim()
  const orgSlug = String(process.env.SUPABASE_ORG_SLUG || '').trim()
  if (!token || !orgSlug) return null

  try {
    const response = await fetch(`https://api.supabase.com/v1/organizations/${encodeURIComponent(orgSlug)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        limitBytes: null,
        plan: null,
        quotaSource: 'none',
        error: `supabase_management_${response.status}`,
      }
    }

    const data = (await response.json()) as SupabaseOrganizationResponse
    const plan = String(data.plan || '').toLowerCase() || null
    return {
      limitBytes: quotaFromPlan(plan),
      plan,
      quotaSource: 'api',
    }
  } catch (err) {
    return {
      limitBytes: null,
      plan: null,
      quotaSource: 'none',
      error: err instanceof Error ? err.message : 'supabase_management_failed',
    }
  }
}

export async function getProjectStorageQuota (): Promise<ProjectStorageQuota> {
  const fromApi = await fetchSupabasePlanQuota()
  if (fromApi?.limitBytes || fromApi?.plan) return fromApi

  const fromEnv = quotaFromEnv()
  if (fromEnv) {
    return {
      ...fromEnv,
      error: fromApi?.error,
    }
  }

  return {
    limitBytes: null,
    plan: fromApi?.plan ?? null,
    quotaSource: fromApi?.quotaSource ?? 'none',
    error: fromApi?.error,
  }
}

export async function getStorageUsageSummary (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<StorageUsageSummary> {
  const [{ data, error }, quota] = await Promise.all([
    supabase.rpc('admin_storage_usage_summary', { p_organization_id: organizationId }),
    getProjectStorageQuota(),
  ])

  if (error) {
    if (isMissingRpcError(error.message)) {
      return getFallbackStorageUsageSummary(supabase, organizationId, quota, error.message)
    }
    throw new Error(error.message)
  }

  const raw = (data || {}) as RawStorageUsageSummary
  const buckets = Array.isArray(raw.project_buckets)
    ? raw.project_buckets.map(toBucket).filter((bucket): bucket is StorageUsageBucket => bucket !== null)
    : []
  const categories = Array.isArray(raw.org_categories)
    ? raw.org_categories.map(toCategory).filter((category): category is StorageUsageCategory => category !== null)
    : []

  return {
    project: {
      usedBytes: toNumber(raw.project_total_bytes),
      limitBytes: quota.limitBytes,
      plan: quota.plan,
      quotaSource: quota.quotaSource,
      ...(quota.error ? { quotaError: quota.error } : {}),
    },
    organization: {
      totalBytes: toNumber(raw.org_total_bytes),
      categories,
    },
    buckets,
  }
}

async function getFallbackStorageUsageSummary (
  supabase: SupabaseClient,
  organizationId: string,
  quota: ProjectStorageQuota,
  reason: string,
): Promise<StorageUsageSummary> {
  const [serviceOrderPhotos, whatsappImages, resalePhotos] = await Promise.all([
    listServiceOrderPhotosWithSizes(supabase, organizationId),
    listStoredWhatsappImages(supabase, organizationId),
    listResaleDevicePhotosWithSizes(supabase, organizationId),
  ])

  const entryPhotos = serviceOrderPhotos.filter((photo) => photo.kind === 'entry')
  const exitPhotos = serviceOrderPhotos.filter((photo) => photo.kind === 'exit')
  const entryBytes = entryPhotos.reduce((sum, photo) => sum + (photo.sizeBytes ?? 0), 0)
  const exitBytes = exitPhotos.reduce((sum, photo) => sum + (photo.sizeBytes ?? 0), 0)
  const whatsappBytes = whatsappImages.reduce((sum, image) => sum + (image.sizeBytes ?? 0), 0)
  const resaleBytes = resalePhotos.reduce((sum, photo) => sum + (photo.sizeBytes ?? 0), 0)

  const categories = [
    buildCategory('os_entry', 'Fotos de entrada de OS', entryPhotos.length, entryBytes),
    buildCategory('os_exit', 'Fotos de saída de OS', exitPhotos.length, exitBytes),
    buildCategory('whatsapp', 'Imagens do WhatsApp', whatsappImages.length, whatsappBytes),
    buildCategory('resale', 'Fotos de seminovos', resalePhotos.length, resaleBytes),
  ]
  const buckets = [
    buildBucket(SERVICE_ORDER_ENTRY_PHOTOS_BUCKET, entryPhotos.length, entryBytes),
    buildBucket(SERVICE_ORDER_EXIT_PHOTOS_BUCKET, exitPhotos.length, exitBytes),
    buildBucket(WHATSAPP_MEDIA_BUCKET, whatsappImages.length, whatsappBytes),
    buildBucket(RESALE_DEVICE_PHOTOS_BUCKET, resalePhotos.length, resaleBytes),
  ].sort((a, b) => b.bytes - a.bytes)
  const totalBytes = categories.reduce((sum, category) => sum + category.bytes, 0)

  return {
    project: {
      usedBytes: totalBytes,
      limitBytes: quota.limitBytes,
      plan: quota.plan,
      quotaSource: quota.quotaSource,
      quotaError: `Resumo parcial: aplique a migration admin_storage_usage_summary. ${reason}`,
    },
    organization: {
      totalBytes,
      categories,
    },
    buckets,
  }
}
