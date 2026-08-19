import { onlyDigits } from '@/lib/utils/strings'

const GTIN_LENGTHS = new Set([8, 12, 13, 14])

function gtinCheckDigit (body: string) {
  let sum = 0
  for (let i = 0; i < body.length; i += 1) {
    const digit = Number(body[body.length - 1 - i])
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) return null
    sum += i % 2 === 0 ? digit * 3 : digit
  }
  return (10 - (sum % 10)) % 10
}

/** GTIN/EAN-8/12/13/14 com dígito verificador válido; senão null (XML deve usar SEM GTIN). */
export function fiscalGtinOrNull (value: unknown): string | null {
  const digits = onlyDigits(String(value ?? ''))
  if (!GTIN_LENGTHS.has(digits.length)) return null
  const expected = gtinCheckDigit(digits.slice(0, -1))
  if (expected == null) return null
  const actual = Number(digits.slice(-1))
  return actual === expected ? digits : null
}

/** Vazio = sem código. Preenchido só aceita GTIN válido e devolve só os dígitos. */
export function normalizeOptionalGtin (value: unknown): string | null | 'invalid' {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return fiscalGtinOrNull(raw) ?? 'invalid'
}
