import sharp from 'sharp'

const FULL_MAX_DIMENSION = 1600
const FULL_JPEG_QUALITY = 82
const THUMB_MAX_DIMENSION = 320
const THUMB_JPEG_QUALITY = 42

export type ImageUploadVariants = {
  full: Buffer
  thumb: Buffer
}

export async function createImageUploadVariants (
  input: Buffer,
): Promise<ImageUploadVariants> {
  const pipeline = sharp(input, { failOn: 'none' }).rotate()

  const [full, thumb] = await Promise.all([
    pipeline
      .clone()
      .resize(FULL_MAX_DIMENSION, FULL_MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: FULL_JPEG_QUALITY, mozjpeg: true, progressive: true })
      .toBuffer(),
    pipeline
      .clone()
      .resize(THUMB_MAX_DIMENSION, THUMB_MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: THUMB_JPEG_QUALITY, mozjpeg: true })
      .toBuffer(),
  ])

  return { full, thumb }
}
