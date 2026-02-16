/**
 * Utilitários de normalização e validação de strings
 */

/** Extrai apenas os dígitos numéricos de uma string */
export function onlyDigits(value: string): string {
  return String(value ?? '').replace(/\D/g, '')
}

/** Valida se a string é um CPF válido (11 dígitos, sem sequência repetida) */
export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value)
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false
  return true
}
