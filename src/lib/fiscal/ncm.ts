import { onlyDigits } from '@/lib/utils/strings'

export function maskNcm (value: unknown) {
  const digits = onlyDigits(String(value ?? '')).slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`
}

export function maskCest (value: unknown) {
  const digits = onlyDigits(String(value ?? '')).slice(0, 7)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
}

/** NCM da SEFAZ: exatamente 8 dígitos, sem pontos. */
export function fiscalNcmOrNull (value: unknown): string | null {
  const digits = onlyDigits(String(value ?? ''))
  return digits.length === 8 ? digits : null
}

/** Vazio = sem NCM. Preenchido só aceita 8 dígitos (máscara é só visual). */
export function normalizeOptionalNcm (value: unknown): string | null | 'invalid' {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return fiscalNcmOrNull(raw) ?? 'invalid'
}

/** CEST da SEFAZ: exatamente 7 dígitos, sem pontos. */
export function fiscalCestOrNull (value: unknown): string | null {
  const digits = onlyDigits(String(value ?? ''))
  return digits.length === 7 ? digits : null
}

/** Vazio = sem CEST. Preenchido só aceita 7 dígitos (máscara é só visual). */
export function normalizeOptionalCest (value: unknown): string | null | 'invalid' {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return fiscalCestOrNull(raw) ?? 'invalid'
}
