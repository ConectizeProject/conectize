export function contentTypeForPhoto (
  storagePath: string,
  blobType?: string | null,
): string {
  if (blobType && blobType.startsWith('image/')) return blobType
  const lower = storagePath.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}
