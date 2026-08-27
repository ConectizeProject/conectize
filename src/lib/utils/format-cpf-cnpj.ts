/**
 * Formatação de CPF e CNPJ (padrão brasileiro).
 */

import { onlyDigits } from '@/lib/utils/strings'

/**
 * Formata CPF: XXX.XXX.XXX-XX (aceita entrada parcial).
 */
export function formatCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  const p1 = digits.slice(0, 3)
  const p2 = digits.slice(3, 6)
  const p3 = digits.slice(6, 9)
  const p4 = digits.slice(9, 11)
  const head = [p1, p2, p3].filter(Boolean).join('.')
  if (p4) return `${head}-${p4}`
  return head || ''
}

/**
 * Formata CNPJ: XX.XXX.XXX/XXXX-XX (aceita entrada parcial).
 */
export function formatCnpj(value: string): string {
  const digits = onlyDigits(value).slice(0, 14)
  const p1 = digits.slice(0, 2)
  const p2 = digits.slice(2, 5)
  const p3 = digits.slice(5, 8)
  const p4 = digits.slice(8, 12)
  const p5 = digits.slice(12, 14)

  const head = [p1, p2, p3].filter(Boolean).join('.')
  if (!head) return ''

  if (p4) {
    if (p5) return `${head}/${p4}-${p5}`
    return `${head}/${p4}`
  }
  return head
}

/**
 * Formata CPF ou CNPJ conforme quantidade de dígitos (≤11 CPF, >11 CNPJ).
 */
export function formatCpfCnpj(value: string): string {
  const digits = onlyDigits(value).slice(0, 14)
  if (digits.length <= 11) return formatCpf(digits)
  return formatCnpj(digits)
}

export function cpfCnpjKindLabel (value: string): 'CPF' | 'CNPJ' | null {
  const digits = onlyDigits(value)
  if (digits.length === 11) return 'CPF'
  if (digits.length === 14) return 'CNPJ'
  return null
}

/** CPF/CNPJ completo com máscara de formatação. Vazio se o documento estiver incompleto. */
export function formatCompleteCpfCnpj (value: string): string {
  const kind = cpfCnpjKindLabel(value)
  if (!kind) return ''
  return formatCpfCnpj(value)
}

const GENERIC_CONSUMER_NAMES = new Set([
  'consumidor',
  'consumidor final',
  'consumidor não identificado',
  'consumidor nao identificado',
])

export function isGenericConsumerName (name: string | null | undefined): boolean {
  const normalized = String(name || '').trim().toLowerCase()
  if (!normalized) return true
  return GENERIC_CONSUMER_NAMES.has(normalized)
}

export function formatIdentifiedConsumer (input: {
  name?: string | null
  document?: string | null
}): {
  identified: boolean
  displayName: string | null
  documentKind: 'CPF' | 'CNPJ' | null
  formattedDocument: string | null
} {
  const rawName = String(input.name || '').trim()
  const displayName = rawName && !isGenericConsumerName(rawName) ? rawName : null
  const formattedDocument = formatCompleteCpfCnpj(String(input.document || '')) || null
  const documentKind = cpfCnpjKindLabel(String(input.document || ''))
  return {
    identified: Boolean(displayName || formattedDocument),
    displayName,
    documentKind,
    formattedDocument,
  }
}
