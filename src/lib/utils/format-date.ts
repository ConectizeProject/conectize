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
 * Formata apenas a data em pt-BR (fuso Brasil).
 * Ex: 12/01/2025
 */
export function formatDateBr(value: string | Date | null | undefined): string {
  if (value == null) return '-'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}
