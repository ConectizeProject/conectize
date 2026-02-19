/**
 * Formatação de CEP (padrão brasileiro: XXXXX-XXX).
 */

import { onlyDigits } from '@/lib/utils/strings'

/**
 * Formata CEP para exibição: XXXXX-XXX.
 * @returns string formatada ou '' se value vazio/inválido
 */
export function formatCepBr(value: string | null | undefined): string {
  if (!value) return ''
  const digits = onlyDigits(value).slice(0, 8)
  const p1 = digits.slice(0, 5)
  const p2 = digits.slice(5, 8)
  if (!p1) return ''
  return p2 ? `${p1}-${p2}` : p1
}
