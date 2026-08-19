export type ServiceOrderPhotoApiPath =
  | 'entry-photos'
  | 'exit-photos'
  | 'assistance-photos'

export function portalServiceOrderPhotoFileUrl (
  orderId: string,
  apiPath: ServiceOrderPhotoApiPath,
  photoId: string,
  variant: 'full' | 'thumb',
): string {
  return `/api/portal/ordens/${orderId}/${apiPath}/${photoId}?variant=${variant}`
}

export function publicOsPhotoFileUrl (
  token: string,
  stage: 'entry' | 'exit' | 'assistance',
  photoId: string,
  variant: 'full' | 'thumb',
): string {
  return `/api/os/${encodeURIComponent(token)}/photos/${stage}/${photoId}?variant=${variant}`
}

export function mapRowsToPortalPhotoItems (
  orderId: string,
  apiPath: ServiceOrderPhotoApiPath,
  rows: Array<{ id: string; created_at: string }> | null,
) {
  return (rows ?? []).map((row) => ({
    id: row.id,
    url: portalServiceOrderPhotoFileUrl(orderId, apiPath, row.id, 'full'),
    thumbUrl: portalServiceOrderPhotoFileUrl(orderId, apiPath, row.id, 'thumb'),
    created_at: row.created_at,
  }))
}

export function mapRowsToPublicOsPhotoItems (
  token: string,
  stage: 'entry' | 'exit' | 'assistance',
  rows: Array<{ id: string; created_at: string }> | null,
) {
  return (rows ?? []).map((row) => ({
    id: row.id,
    url: publicOsPhotoFileUrl(token, stage, row.id, 'full'),
    thumbUrl: publicOsPhotoFileUrl(token, stage, row.id, 'thumb'),
    created_at: row.created_at,
  }))
}
