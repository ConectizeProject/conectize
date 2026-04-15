/** Centavos → string para input tipo "1234,56" (pt-BR). */
export function centsToBrlInput (cents: number | null | undefined): string {
  if (cents == null) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}

/**
 * Texto em reais (pt-BR) → centavos inteiros.
 * Aceita "120", "120,50", "1.234,56". String vazia → null (opcional).
 */
export function brlInputToCentsOrNull (raw: string): number | null | 'invalid' {
  const t = raw.trim().replace(/R\$\s?/gi, '').replace(/\s/g, '')
  if (!t) return null
  const lastComma = t.lastIndexOf(',')
  const lastDot = t.lastIndexOf('.')
  let normalized: string
  if (lastComma !== -1 && lastDot !== -1) {
    normalized = lastComma > lastDot
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '')
  } else if (lastComma !== -1) {
    normalized = t.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = t.replace(/,/g, '')
  }
  const n = Number(normalized)
  if (!Number.isFinite(n) || n < 0) return 'invalid'
  return Math.round(n * 100)
}
