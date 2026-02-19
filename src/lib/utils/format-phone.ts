/**
 * Formatação de telefone/celular para exibição e uso em links (WhatsApp).
 * Padrão brasileiro: (XX) XXXX-XXXX ou (XX) 9 XXXX-XXXX.
 */

/**
 * Formata número para exibição no padrão brasileiro.
 * (XX) XXXX-XXXX para fixo, (XX) 9 XXXX-XXXX para celular.
 * @returns string formatada ou null se value for vazio/inválido
 */
export function formatPhoneBr(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = String(value).replace(/\D/g, '').slice(0, 11)
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  if (!ddd) return null
  if (rest.length <= 8) {
    const p1 = rest.slice(0, 4)
    const p2 = rest.slice(4, 8)
    return `(${ddd}) ${[p1, p2].filter(Boolean).join('-')}`.trim()
  }
  const p1 = rest.slice(0, 1)
  const p2 = rest.slice(1, 5)
  const p3 = rest.slice(5, 9)
  return `(${ddd}) ${p1} ${[p2, p3].filter(Boolean).join('-')}`.trim()
}

/**
 * Retorna apenas dígitos do número, com código do país 55 para Brasil.
 * Útil para links wa.me e outros usos que exigem número sem formatação.
 * @returns string de dígitos (ex: 5531999999999) ou '' se inválido
 */
export function formatPhoneForWhatsApp(value: string | null | undefined): string {
  if (!value) return ''
  const digits = String(value).replace(/\D/g, '').trim()
  if (!digits) return ''
  return digits.length <= 11 && !digits.startsWith('55') ? `55${digits}` : digits
}
