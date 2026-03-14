const MAX_DIMENSION = 1200
const JPEG_QUALITY = 0.82
const PNG_QUALITY = 0.9

const COMPRESSIBLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * Comprime uma imagem para no máximo MAX_DIMENSION px no maior lado,
 * mantendo proporção e qualidade aceitável.
 * HEIC e outros não suportados pelo canvas são retornados sem compressão.
 */
export function compressImageForEntry (file: File): Promise<Blob> {
  if (!COMPRESSIBLE_TYPES.has(file.type)) {
    return Promise.resolve(file as unknown as Blob)
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const w = img.naturalWidth
      const h = img.naturalHeight
      if (w <= MAX_DIMENSION && h <= MAX_DIMENSION) {
        resolve(file as unknown as Blob)
        return
      }
      const scale = MAX_DIMENSION / Math.max(w, h)
      const cw = Math.round(w * scale)
      const ch = Math.round(h * scale)

      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file as unknown as Blob)
        return
      }
      ctx.drawImage(img, 0, 0, cw, ch)

      const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      const quality = file.type === 'image/png' ? PNG_QUALITY : JPEG_QUALITY
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else resolve(file as unknown as Blob)
        },
        mime,
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file as unknown as Blob)
    }

    img.src = url
  })
}
