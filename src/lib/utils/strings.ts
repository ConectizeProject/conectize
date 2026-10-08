/**
 * Utilitários de normalização e validação de strings
 */

/** Extrai apenas os dígitos numéricos de uma string */
export function onlyDigits(value: string): string {
  return String(value ?? '').replace(/\D/g, '')
}

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

/** Valida e-mail no formato nome@dominio.com */
export function isEmailFormat(value: string): boolean {
  const email = String(value ?? '').trim()
  if (!email || email.length > 160) return false
  return EMAIL_FORMAT.test(email)
}

function cpfCheckDigit(base: number[]): number {
  const factorStart = base.length + 1
  const sum = base.reduce((total, digit, index) => total + (digit * (factorStart - index)), 0)
  const mod = sum % 11
  return mod < 2 ? 0 : 11 - mod
}

/** Valida CPF no formato de 11 dígitos, com dígitos verificadores */
export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value)
  if (!/^\d{11}$/.test(digits)) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  const numbers = digits.split('').map((digit) => Number.parseInt(digit, 10))
  const first = cpfCheckDigit(numbers.slice(0, 9))
  const second = cpfCheckDigit(numbers.slice(0, 9).concat(first))
  return numbers[9] === first && numbers[10] === second
}
