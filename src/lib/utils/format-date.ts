/**
 * Utilitários de formatação de datas para exibição.
 *
 * Regras do projeto:
 * - Salvar: sempre UTC (Supabase timestamptz, ou new Date().toISOString())
 * - Exibir: sempre horário de Brasília (America/Sao_Paulo) usando estas funções
 */

/**
 * Formata data+hora em pt-BR (fuso Brasil) sem segundos.
 * Ex: 12/01/2025, 14:30
 *
 * Obs: força o fuso para America/Sao_Paulo para evitar
 * diferenças entre timezone do servidor e do navegador.
 */
export function formatDateTimeBr(value: string | Date | null | undefined): string {
  if (value == null) return '-'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

/**
 * Formata data+hora em pt-BR (fuso Brasil) com ano em 2 dígitos.
 * Ex: 12/01/25, 14:30
 * Útil para etiquetas e espaços reduzidos.
 */
export function formatDateTimeShortBr(value: string | Date | null | undefined): string {
  if (value == null) return '-'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

/**
 * Como formatDateTimeShortBr, sem vírgula entre data e hora (ex.: 16/04/26 15:27).
 */
export function formatDateTimeShortBrNoComma(
  value: string | Date | null | undefined,
): string {
  const s = formatDateTimeShortBr(value)
  if (s === '-' || s === String(value)) return s
  return s.replace(/\s*,\s*/, ' ')
}

/**
 * Formata apenas a data em pt-BR (fuso Brasil).
 * Ex: 12/01/2025
 */
export function formatDateBr(value: string | Date | null | undefined): string {
  if (value == null) return '-'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}
