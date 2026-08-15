const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.72

/**
 * Comprime no cliente (JPEG) para reduzir o upload.
 * O servidor gera de novo o JPEG final e a thumb de preview.
 * HEIC e outros não decodificados pelo canvas seguem o arquivo original.
 */
export function compressImageForEntry (file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    return Promise.resolve(file)
  }

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const w = img.naturalWidth
      const h = img.naturalHeight
      if (!w || !h) {
        resolve(file)
        return
      }
      const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h))
      const cw = Math.max(1, Math.round(w * scale))
      const ch = Math.max(1, Math.round(h * scale))

      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, cw, ch)
      canvas.toBlob(
        (blob) => {
          resolve(blob && blob.size > 0 ? blob : file)
        },
        'image/jpeg',
        JPEG_QUALITY,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }

    img.src = url
  })
}
