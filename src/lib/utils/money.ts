export function formatMoneyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  let int = digits
  if (int.length === 1) int = `0${int}`
  const cents = int.slice(-2)
  let whole = int.slice(0, -2) || '0'
  whole = whole.replace(/^0+/, '') || '0'
  whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${whole},${cents}`
}

export function moneyToCentsFromMasked(value: string): number | null {
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  return Number.parseInt(digits, 10)
}

export function maskedFromCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const digits = String(abs)
  let int = digits
  if (int.length === 1) int = `0${int}`
  const frac = int.slice(-2)
  let whole = int.slice(0, -2) || '0'
  whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${whole},${frac}`
}

/** Arredonda centavos para cima ao real inteiro (ex.: 119935 → 120000). */
export function ceilCentsToWholeReais (cents: number): number {
  if (!Number.isFinite(cents) || cents <= 0) return 0
  return Math.ceil(cents / 100) * 100
}

/** Formata centavos em reais inteiros sem casas decimais (ex.: 120000 → 1.200). */
export function maskedWholeReaisFromCents (cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  const rounded = ceilCentsToWholeReais(cents)
  const sign = rounded < 0 ? '-' : ''
  const whole = String(Math.abs(rounded) / 100)
  const withDots = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${withDots}`
}

function isNegativeMoneyMask (value: string): boolean {
  const trimmed = value.trim()
  return trimmed.startsWith('-') || trimmed.startsWith('−')
}

/** Formata input monetário permitindo valor negativo (ex.: -100,50) */
export function formatMoneyInputSigned(raw: string): string {
  const isNegative = isNegativeMoneyMask(raw)
  const digits = raw.replace(/\D/g, '')
  if (!digits) return isNegative ? '-' : ''
  let int = digits
  if (int.length === 1) int = `0${int}`
  const cents = int.slice(-2)
  let whole = int.slice(0, -2) || '0'
  whole = whole.replace(/^0+/, '') || '0'
  whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return isNegative ? `-${whole},${cents}` : `${whole},${cents}`
}

/** Converte string mascarada (ex.: -100,50) em centavos; aceita negativo */
export function moneyToCentsFromMaskedSigned(value: string): number | null {
  const isNegative = isNegativeMoneyMask(value)
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  const cents = Number.parseInt(digits, 10)
  return isNegative ? -cents : cents
}

