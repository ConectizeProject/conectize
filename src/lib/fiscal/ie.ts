import { onlyDigits } from '@/lib/utils/strings'

/** Tamanho usual da IE (só dígitos). UFs com mais de um tamanho ficam de fora. */
const IE_DIGIT_LENGTH: Record<string, number> = {
  AC: 13,
  AL: 9,
  AM: 9,
  AP: 9,
  CE: 9,
  DF: 13,
  ES: 9,
  GO: 9,
  MA: 9,
  MG: 13,
  MS: 9,
  MT: 11,
  PA: 9,
  PB: 9,
  PI: 9,
  PR: 10,
  RJ: 8,
  RN: 9,
  RR: 9,
  RS: 10,
  SC: 9,
  SE: 9,
  SP: 12,
  TO: 11,
}

export function fiscalIeOrNull (value: unknown, uf?: string | null) {
  const digits = onlyDigits(String(value || ''))
  if (!digits) return null
  const length = IE_DIGIT_LENGTH[String(uf || '').trim().toUpperCase()]
  if (!length || digits.length >= length) return digits
  return digits.padStart(length, '0')
}
