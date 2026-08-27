import { describe, expect, it } from 'vitest'
import {
  formatCompleteCpfCnpj,
  formatIdentifiedConsumer,
  isGenericConsumerName,
} from '@/lib/utils/format-cpf-cnpj'

describe('formatCompleteCpfCnpj', () => {
  it('formats a complete CPF', () => {
    expect(formatCompleteCpfCnpj('12345678901')).toBe('123.456.789-01')
  })

  it('formats a complete CNPJ', () => {
    expect(formatCompleteCpfCnpj('12345678000190')).toBe('12.345.678/0001-90')
  })

  it('returns empty when the document is incomplete', () => {
    expect(formatCompleteCpfCnpj('123456789')).toBe('')
    expect(formatCompleteCpfCnpj('')).toBe('')
  })
})

describe('formatIdentifiedConsumer', () => {
  it('treats generic names without document as not identified', () => {
    expect(isGenericConsumerName('Consumidor Final')).toBe(true)
    expect(formatIdentifiedConsumer({
      name: 'Consumidor Final',
      document: null,
    }).identified).toBe(false)
  })

  it('identifies by CPF even with a generic name', () => {
    const consumer = formatIdentifiedConsumer({
      name: 'Consumidor Final',
      document: '12345678901',
    })
    expect(consumer.identified).toBe(true)
    expect(consumer.displayName).toBe(null)
    expect(consumer.documentKind).toBe('CPF')
    expect(consumer.formattedDocument).toBe('123.456.789-01')
  })

  it('identifies by name without document', () => {
    const consumer = formatIdentifiedConsumer({
      name: 'Maria Silva',
      document: '',
    })
    expect(consumer.identified).toBe(true)
    expect(consumer.displayName).toBe('Maria Silva')
    expect(consumer.formattedDocument).toBe(null)
  })
})
