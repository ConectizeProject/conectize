import type { SupabaseClient } from '@supabase/supabase-js'

/** Escapa `%` e `_` para uso em `.ilike.%…%` no PostgREST. */
export function escapeIlikePattern (raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

const MACRO_CUSTOMER_CAP = 120

/**
 * IDs de clientes que casam com o texto macro (nome fantasia, razão, documento).
 * Exige ao menos 2 caracteres (evita busca custosa e resultados demais).
 */
export async function fetchCustomerIdsForOrdensMacroSearch (
  supabase: SupabaseClient,
  rawQ: string,
): Promise<string[]> {
  const trimmed = rawQ.trim()
  if (!trimmed || trimmed.length < 2) return []

  const esc = escapeIlikePattern(trimmed)
  const parts: string[] = [
    `full_name.ilike.%${esc}%`,
    `company_name.ilike.%${esc}%`,
    `trade_name.ilike.%${esc}%`,
  ]

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length >= 3) {
    const dEsc = escapeIlikePattern(digits)
    parts.push(`cpf.ilike.%${dEsc}%`)
    parts.push(`cnpj.ilike.%${dEsc}%`)
  }
  if (digits.length === 11 || digits.length === 14) {
    parts.push(`cpf.eq.${digits}`)
    parts.push(`cnpj.eq.${digits}`)
  }

  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .or(parts.join(','))
    .limit(MACRO_CUSTOMER_CAP)

  if (error) {
    console.warn('[portal-ordens-macro-search] customers:', error.message)
    return []
  }

  return [...new Set((data ?? []).map((r: { id: string }) => r.id))]
}

/**
 * Cláusula `.or(...)` para `service_orders`: título, descrição, nº OS exibido, clientes.
 * — IMEI não entra na busca macro.
 * — 1 caractere não alfanumérico “só letra”: ignora (evita `ilike` muito amplo).
 * — só dígitos com 1 caractere: apenas `display_number` (ex.: OS #5).
 */
export function buildServiceOrdersMacroQOrClause (
  rawQ: string,
  customerIds: string[],
): string {
  const trimmed = rawQ.trim()
  if (!trimmed) return ''

  const onlyDigits = /^\d+$/.test(trimmed)
  if (trimmed.length < 2 && !onlyDigits) {
    return ''
  }

  const esc = escapeIlikePattern(trimmed)
  const capped = customerIds.slice(0, MACRO_CUSTOMER_CAP)
  const orParts: string[] = []

  if (onlyDigits) {
    const n = Number.parseInt(trimmed, 10)
    if (!Number.isNaN(n)) {
      orParts.push(`display_number.eq.${n}`)
    }
    if (trimmed.length === 1) {
      return orParts.join(',')
    }
  }

  orParts.push(`title.ilike.%${esc}%`, `description.ilike.%${esc}%`)
  if (capped.length > 0) {
    orParts.push(`customer_id.in.(${capped.join(',')})`)
  }

  return orParts.join(',')
}
