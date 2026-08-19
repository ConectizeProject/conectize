/** Fetch/undici trata `Buffer` do Node como texto UTF-8 e corrompe JPEG no Storage. */
export function toStorageUploadBody (bytes: Buffer | Uint8Array): Uint8Array {
  return new Uint8Array(bytes)
}
