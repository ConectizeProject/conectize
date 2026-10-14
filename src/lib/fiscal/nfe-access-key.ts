const ACCESS_KEY_WEIGHTS_MAX = 9

/** Dígito verificador da chave de acesso (módulo 11, pesos 2 a 9 da direita para a esquerda). */
export function nfeAccessKeyCheckDigit (base43: string) {
  if (!/^\d{43}$/.test(base43)) return null
  let weight = 2
  let sum = 0
  for (let index = base43.length - 1; index >= 0; index -= 1) {
    sum += Number(base43[index]) * weight
    weight = weight === ACCESS_KEY_WEIGHTS_MAX ? 2 : weight + 1
  }
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

export function isValidNfeAccessKey (key: string) {
  if (!/^\d{44}$/.test(key)) return false
  return nfeAccessKeyCheckDigit(key.slice(0, 43)) === Number(key[43])
}

/** Modelo do documento na chave: 55 NF-e, 65 NFC-e. */
export function nfeAccessKeyModel (key: string) {
  const digits = String(key || '').replace(/\D/g, '')
  if (digits.length !== 44) return null
  return digits.slice(20, 22)
}

/**
 * Lê a chave de 44 dígitos de um leitor de código de barras, de um QR do DANFE
 * ou de um texto colado. Prefere chave com dígito verificador válido.
 */
export function extractNfeAccessKey (raw: string) {
  const text = String(raw || '')
  const contiguous = text.match(/\d{44}/g) || []
  const fromContiguous = contiguous.find((candidate) => isValidNfeAccessKey(candidate))
  if (fromContiguous) return fromContiguous

  const digits = text.replace(/\D/g, '')
  if (digits.length < 44) return null
  for (let index = 0; index <= digits.length - 44; index += 1) {
    const candidate = digits.slice(index, index + 44)
    if (isValidNfeAccessKey(candidate)) return candidate
  }
  return null
}
