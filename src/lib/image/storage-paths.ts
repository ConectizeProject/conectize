const THUMB_SUFFIX = '.thumb.jpg'

export function toThumbStoragePath (storagePath: string): string {
  const path = storagePath.trim()
  if (!path) return path
  if (path.endsWith(THUMB_SUFFIX)) return path
  const slash = path.lastIndexOf('/')
  const filename = slash >= 0 ? path.slice(slash + 1) : path
  const dir = slash >= 0 ? path.slice(0, slash + 1) : ''
  const dot = filename.lastIndexOf('.')
  const stem = dot > 0 ? filename.slice(0, dot) : filename
  return `${dir}${stem}${THUMB_SUFFIX}`
}

export function storagePathsWithThumb (storagePath: string): string[] {
  const path = storagePath.trim()
  if (!path) return []
  const thumb = toThumbStoragePath(path)
  return thumb === path ? [path] : [path, thumb]
}

export function expandStoragePathsWithThumbs (paths: string[]): string[] {
  const unique = new Set<string>()
  for (const path of paths) {
    for (const item of storagePathsWithThumb(path)) unique.add(item)
  }
  return [...unique]
}
