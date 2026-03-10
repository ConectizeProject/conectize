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

/** Formata input monetário permitindo valor negativo (ex.: -100,50) */
export function formatMoneyInputSigned(raw: string): string {
  const isNegative = raw.trimStart().startsWith('-')
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
  const trimmed = value.trim()
  const isNegative = trimmed.startsWith('-')
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  const cents = Number.parseInt(digits, 10)
  return isNegative ? -cents : cents
}

